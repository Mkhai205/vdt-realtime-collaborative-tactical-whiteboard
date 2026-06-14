import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  ObjectMutablePatch,
  OperationAppliedEvent,
  OperationRejectedEvent,
  UndoRedoOperation,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import { getRoomObjects } from "./whiteboard-api"
import {
  type WhiteboardOperationSender,
  type WhiteboardOperationSenderOptions,
  useWhiteboardStore,
} from "@/stores/whiteboard-store"
import {
  createRedoOperation,
  createUndoOperation,
  moveLatestRedoToUndo,
  moveLatestUndoToRedo,
  pushUndoStackEntry,
  type WhiteboardHistoryEntry,
} from "./whiteboard-history"

vi.mock("@/components/features/whiteboard/whiteboard-api", () => ({
  getRoomObjects: vi.fn(),
}))

const actor: UserSummary = {
  id: uuid(1),
  name: "Planner One",
  avatarColor: "#3B82F6",
}

let roomCounter = 100
let activeRoomId = uuid(roomCounter)

const objectId = uuid(201)
const serverCreateObjectId = uuid(202)
const timestamp = "2026-06-11T00:00:00.000Z"
const getRoomObjectsMock = vi.mocked(getRoomObjects)

describe("whiteboard history stacks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeRoomId = uuid(roomCounter++)
    loadRoom()
  })

  it("moves latest undo entries to redo and latest redo entries back to undo in order", () => {
    const firstEntry = makeHistoryEntry({ operationId: uuid(301) })
    const secondEntry = makeHistoryEntry({ operationId: uuid(302) })
    const firstPush = pushUndoStackEntry([], firstEntry)
    const secondPush = pushUndoStackEntry(firstPush.undoStack, secondEntry)

    const undoSecond = moveLatestUndoToRedo(
      secondPush.undoStack,
      secondPush.redoStack,
    )
    const undoFirst = moveLatestUndoToRedo(
      undoSecond.undoStack,
      undoSecond.redoStack,
    )
    const redoFirst = moveLatestRedoToUndo(
      undoFirst.undoStack,
      undoFirst.redoStack,
    )
    const redoSecond = moveLatestRedoToUndo(
      redoFirst.undoStack,
      redoFirst.redoStack,
    )

    expect(undoSecond.movedEntry).toBe(secondEntry)
    expect(undoFirst.redoStack.map((entry) => entry.operationId)).toEqual([
      secondEntry.operationId,
      firstEntry.operationId,
    ])
    expect(redoFirst.movedEntry).toBe(firstEntry)
    expect(redoSecond.movedEntry).toBe(secondEntry)
    expect(redoSecond.undoStack.map((entry) => entry.operationId)).toEqual([
      firstEntry.operationId,
      secondEntry.operationId,
    ])
    expect(redoSecond.redoStack).toEqual([])
  })

  it("creates inverse operations for create, update, and delete entries", () => {
    const createEntry = makeHistoryEntry({
      type: "OBJECT_CREATE",
      beforeObject: null,
      afterObject: makeObject({ id: objectId, version: 1 }),
      forwardAction: {
        type: "OBJECT_CREATE",
        object: {
          type: "RECTANGLE",
          x: 10,
          y: 20,
          width: 100,
          height: 80,
          style: {
            fill: "#ffffff",
          },
        },
      },
    })
    const updateEntry = makeHistoryEntry({
      beforeObject: makeObject({
        id: objectId,
        x: 10,
        style: {
          fill: "#ffffff",
          stroke: "#111111",
        },
      }),
      afterObject: makeObject({
        id: objectId,
        x: 40,
        version: 4,
        style: {
          fill: "#ffffff",
          stroke: "#ff0000",
        },
      }),
      forwardAction: {
        type: "OBJECT_UPDATE",
        patch: {
          x: 40,
          style: {
            stroke: "#ff0000",
          },
        },
      },
    })
    const deleteEntry = makeHistoryEntry({
      type: "OBJECT_DELETE",
      afterObject: makeObject({
        id: objectId,
        deletedAt: timestamp,
        version: 6,
      }),
      forwardAction: {
        type: "OBJECT_DELETE",
      },
    })

    expect(createUndoOperation(createEntry)).toEqual({
      type: "OBJECT_DELETE",
      objectId,
      baseObjectVersion: 1,
    })
    expect(createUndoOperation(updateEntry)).toEqual({
      type: "OBJECT_UPDATE",
      objectId,
      baseObjectVersion: 4,
      patch: {
        x: 10,
        style: {
          fill: "#ffffff",
          stroke: "#111111",
        },
      },
    })
    expect(createUndoOperation(deleteEntry)).toEqual({
      type: "OBJECT_RESTORE",
      objectId,
      baseObjectVersion: 6,
    })
  })

  it("creates redo operations for create, update, and delete entries", () => {
    const createEntry = makeHistoryEntry({
      type: "OBJECT_CREATE",
      objectId,
      redoBaseObjectVersion: 2,
      forwardAction: {
        type: "OBJECT_CREATE",
        object: {
          type: "RECTANGLE",
          x: 10,
          y: 20,
          width: 100,
          height: 80,
        },
      },
    })
    const updateEntry = makeHistoryEntry({
      redoBaseObjectVersion: 5,
      forwardAction: {
        type: "OBJECT_UPDATE",
        patch: {
          x: 42,
          points: [0, 0, 10, 10],
        },
      },
    })
    const deleteEntry = makeHistoryEntry({
      type: "OBJECT_DELETE",
      redoBaseObjectVersion: 8,
      forwardAction: {
        type: "OBJECT_DELETE",
      },
    })

    expect(createRedoOperation(createEntry)).toEqual({
      type: "OBJECT_RESTORE",
      objectId,
      baseObjectVersion: 2,
    })
    expect(createRedoOperation(updateEntry)).toEqual({
      type: "OBJECT_UPDATE",
      objectId,
      baseObjectVersion: 5,
      patch: {
        x: 42,
        points: [0, 0, 10, 10],
      },
    })
    expect(createRedoOperation(deleteEntry)).toEqual({
      type: "OBJECT_DELETE",
      objectId,
      baseObjectVersion: 8,
    })
  })

  it("pushes one undo entry for an accepted local create using the server object id", async () => {
    loadRoom([])
    installAcceptingOperationSender()

    const optimisticObject = useWhiteboardStore.getState().createLocalObject({
      type: "RECTANGLE",
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      style: {
        fill: "#ffffff",
        stroke: "#111111",
        strokeWidth: 2,
        opacity: 1,
      },
    })

    await waitFor(() => useWhiteboardStore.getState().undoStack.length === 1)

    const state = useWhiteboardStore.getState()
    const entry = state.undoStack[0]

    expect(optimisticObject?.id).not.toBe(serverCreateObjectId)
    expect(entry?.type).toBe("OBJECT_CREATE")
    expect(entry?.objectId).toBe(serverCreateObjectId)
    expect(entry?.beforeObject).toBeNull()
    expect(entry?.afterObject?.id).toBe(serverCreateObjectId)
    expect(entry?.forwardAction.type).toBe("OBJECT_CREATE")
    expect(state.objects[optimisticObject?.id ?? ""]).toBeUndefined()
    expect(state.objects[serverCreateObjectId]).toBeDefined()
    expect(state.redoStack).toEqual([])
  })

  it("pushes one undo entry for an accepted local update with before and after snapshots", async () => {
    const object = makeObject({
      id: objectId,
      x: 10,
      version: 3,
      style: {
        fill: "#ffffff",
        stroke: "#111111",
        strokeWidth: 2,
        opacity: 1,
      },
    })
    const patch: ObjectMutablePatch = {
      x: 42,
      style: {
        stroke: "#ff0000",
      },
    }

    loadRoom([object], 3)
    installAcceptingOperationSender()
    useWhiteboardStore.getState().updateObjectPatch(object.id, patch)

    await waitFor(() => useWhiteboardStore.getState().undoStack.length === 1)

    const entry = useWhiteboardStore.getState().undoStack[0]

    expect(entry?.type).toBe("OBJECT_UPDATE")
    expect(entry?.objectId).toBe(object.id)
    expect(entry?.beforeObject?.x).toBe(10)
    expect(entry?.beforeObject?.style.stroke).toBe("#111111")
    expect(entry?.afterObject?.x).toBe(42)
    expect(entry?.afterObject?.style.stroke).toBe("#ff0000")
    expect(entry?.forwardAction).toEqual({
      type: "OBJECT_UPDATE",
      patch,
    })
  })

  it("pushes one undo entry for an accepted local delete", async () => {
    const object = makeObject({ id: objectId, version: 5 })

    loadRoom([object], 5)
    installAcceptingOperationSender()
    useWhiteboardStore.getState().selectObject(object.id)
    useWhiteboardStore.getState().deleteSelectedObject()

    await waitFor(() => useWhiteboardStore.getState().undoStack.length === 1)

    const entry = useWhiteboardStore.getState().undoStack[0]

    expect(entry?.type).toBe("OBJECT_DELETE")
    expect(entry?.objectId).toBe(object.id)
    expect(entry?.beforeObject?.deletedAt).toBeUndefined()
    expect(entry?.afterObject?.deletedAt).toBeTruthy()
  })

  it("does not push an undo entry for rejected local operations", async () => {
    const object = makeObject({ id: objectId, version: 1 })
    const sender: WhiteboardOperationSender = {
      createObject: vi.fn(),
      updateObject: vi.fn(async (request) => {
        const rejection: OperationRejectedEvent = {
          clientOpId: request.clientOpId,
          roomId: request.roomId,
          reason: "OBJECT_VERSION_CONFLICT",
          message: "Object changed.",
          latestObject: makeObject({ id: object.id, version: 2 }),
          currentRoomRevision: 2,
        }

        throw rejection
      }),
      deleteObject: vi.fn(),
      undoOperation: vi.fn(),
      redoOperation: vi.fn(),
    }

    loadRoom([object], 1)
    useWhiteboardStore.getState().setObjectOperationSender(sender)
    useWhiteboardStore.getState().updateObjectPatch(object.id, { x: 99 })

    await waitFor(() => vi.mocked(sender.updateObject).mock.calls.length === 1)
    await flushAsync()

    expect(useWhiteboardStore.getState().undoStack).toEqual([])
    expect(useWhiteboardStore.getState().redoStack).toEqual([])
  })

  it("does not push an undo entry for failed local operations", async () => {
    const object = makeObject({ id: objectId, version: 1 })
    const sender: WhiteboardOperationSender = {
      createObject: vi.fn(),
      updateObject: vi.fn(async () => {
        throw new Error("Socket unavailable.")
      }),
      deleteObject: vi.fn(),
      undoOperation: vi.fn(),
      redoOperation: vi.fn(),
    }

    loadRoom([object], 1)
    getRoomObjectsMock.mockResolvedValue({
      roomId: activeRoomId,
      currentRevision: 1,
      objects: [object],
    })
    useWhiteboardStore.getState().setObjectOperationSender(sender)
    useWhiteboardStore.getState().updateObjectPatch(object.id, { x: 99 })

    await waitFor(() => getRoomObjectsMock.mock.calls.length === 1)

    expect(useWhiteboardStore.getState().undoStack).toEqual([])
    expect(useWhiteboardStore.getState().redoStack).toEqual([])
  })

  it("leaves stacks unchanged for remote operations", () => {
    const object = makeObject({ id: objectId, version: 1 })
    const redoEntry = makeHistoryEntry({ objectId: object.id })

    loadRoom([object], 1)
    useWhiteboardStore.getState().pushUndoEntry(redoEntry)
    useWhiteboardStore.getState().moveLatestUndoEntryToRedo()
    useWhiteboardStore.getState().applyOperation(
      makeOperation({
        clientOpId: "remote-client-op",
        objectId: object.id,
        resultingObject: makeObject({
          id: object.id,
          x: 300,
          version: 2,
        }),
        revision: 2,
        type: "OBJECT_UPDATE",
      }),
    )

    const state = useWhiteboardStore.getState()

    expect(state.undoStack).toEqual([])
    expect(state.redoStack.map((entry) => entry.operationId)).toEqual([
      redoEntry.operationId,
    ])
  })

  it("clears redo after a new accepted local operation", async () => {
    const object = makeObject({ id: objectId, version: 1 })
    const redoEntry = makeHistoryEntry({ objectId: object.id })

    loadRoom([object], 1)
    useWhiteboardStore.getState().pushUndoEntry(redoEntry)
    useWhiteboardStore.getState().moveLatestUndoEntryToRedo()
    installAcceptingOperationSender()
    useWhiteboardStore.getState().updateObjectPatch(object.id, { x: 66 })

    await waitFor(() => useWhiteboardStore.getState().undoStack.length === 1)

    const state = useWhiteboardStore.getState()

    expect(state.undoStack[0]?.clientOpId).not.toBe(redoEntry.clientOpId)
    expect(state.redoStack).toEqual([])
  })

  it("clears history on room and full-state replacement", () => {
    const object = makeObject({ id: objectId, version: 1 })

    loadRoom([object], 1)
    pushRedoEntry()
    useWhiteboardStore
      .getState()
      .setLoadedRoomState(makeLoadedRoomStateInput([object], 1))
    expectHistoryToBeEmpty()

    pushRedoEntry()
    useWhiteboardStore.getState().setObjectsWithRevision([object], 2)
    expectHistoryToBeEmpty()

    pushRedoEntry()
    useWhiteboardStore.getState().setRoomId(uuid(999))
    expectHistoryToBeEmpty()
  })

  it("submits accepted undo and redo operations without adding fresh history entries", async () => {
    const object = makeObject({ id: objectId, x: 10, version: 3 })
    const patch: ObjectMutablePatch = {
      x: 42,
    }
    const sender = installAcceptingOperationSender()

    loadRoom([object], 3)
    useWhiteboardStore.getState().setObjectOperationSender(sender)
    useWhiteboardStore.getState().updateObjectPatch(object.id, patch)

    await waitFor(() => useWhiteboardStore.getState().undoStack.length === 1)

    useWhiteboardStore.getState().undoLastOperation()

    await waitFor(() => useWhiteboardStore.getState().redoStack.length === 1)

    expect(sender.undoOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: activeRoomId,
        inverseOperation: {
          type: "OBJECT_UPDATE",
          objectId,
          baseObjectVersion: 4,
          patch: {
            x: 10,
          },
        },
      }),
    )
    expect(useWhiteboardStore.getState().objects[objectId]?.x).toBe(10)
    expect(useWhiteboardStore.getState().undoStack).toEqual([])
    expect(
      useWhiteboardStore.getState().redoStack[0]?.redoBaseObjectVersion,
    ).toBe(5)

    useWhiteboardStore.getState().redoLastOperation()

    await waitFor(() => useWhiteboardStore.getState().undoStack.length === 1)

    expect(sender.redoOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: activeRoomId,
        redoOperation: {
          type: "OBJECT_UPDATE",
          objectId,
          baseObjectVersion: 5,
          patch,
        },
      }),
    )
    expect(useWhiteboardStore.getState().objects[objectId]?.x).toBe(42)
    expect(useWhiteboardStore.getState().undoStack).toHaveLength(1)
    expect(
      useWhiteboardStore.getState().undoStack[0]?.afterObject?.version,
    ).toBe(6)
    expect(useWhiteboardStore.getState().redoStack).toEqual([])
  })

  it("leaves stacks unchanged when undo is rejected", async () => {
    const object = makeObject({ id: objectId, version: 1 })
    const entry = makeHistoryEntry({
      objectId,
      afterObject: makeObject({ id: objectId, version: 2 }),
    })
    const rejection: OperationRejectedEvent = {
      clientOpId: "undo-client-op",
      roomId: activeRoomId,
      reason: "OBJECT_VERSION_CONFLICT",
      message: "Object changed before undo.",
      latestObject: makeObject({ id: objectId, version: 3 }),
      currentRoomRevision: 3,
    }
    const sender: WhiteboardOperationSender = {
      createObject: vi.fn(),
      updateObject: vi.fn(),
      deleteObject: vi.fn(),
      undoOperation: vi.fn(async () => {
        throw rejection
      }),
      redoOperation: vi.fn(),
    }

    loadRoom([object], 1)
    useWhiteboardStore.getState().setObjectOperationSender(sender)
    useWhiteboardStore.getState().pushUndoEntry(entry)
    useWhiteboardStore.getState().undoLastOperation()

    await waitFor(() => vi.mocked(sender.undoOperation).mock.calls.length === 1)
    await flushAsync()

    expect(useWhiteboardStore.getState().undoStack).toEqual([entry])
    expect(useWhiteboardStore.getState().redoStack).toEqual([])
    expect(useWhiteboardStore.getState().objects[objectId]?.version).toBe(3)
  })
})

function installAcceptingOperationSender() {
  const sender: WhiteboardOperationSender = {
    createObject: vi.fn(async (request, options) => {
      const resultingObject = makeObject({
        id: serverCreateObjectId,
        roomId: request.roomId,
        type: request.object.type,
        x: request.object.x,
        y: request.object.y,
        width: request.object.width,
        height: request.object.height,
        points: request.object.points,
        text: request.object.text,
        rotation: request.object.rotation ?? 0,
        style: request.object.style ?? {},
        zIndex: request.object.zIndex ?? 10,
      })
      const operation = makeOperation({
        clientOpId: request.clientOpId,
        objectId: resultingObject.id,
        resultingObject,
        revision: useWhiteboardStore.getState().currentRevision + 1,
        roomId: request.roomId,
        type: "OBJECT_CREATE",
      })

      applyAcceptedOperation(operation, options)
      return operation
    }),
    updateObject: vi.fn(async (request, options) => {
      const object = useWhiteboardStore.getState().objects[request.objectId]
      const baseObject = object ?? makeObject({ id: request.objectId })
      const resultingObject = makeObject({
        ...baseObject,
        id: request.objectId,
        roomId: request.roomId,
        version: baseObject.version + 1,
      })
      const operation = makeOperation({
        clientOpId: request.clientOpId,
        objectId: request.objectId,
        resultingObject,
        revision: useWhiteboardStore.getState().currentRevision + 1,
        roomId: request.roomId,
        type: "OBJECT_UPDATE",
      })

      applyAcceptedOperation(operation, options)
      return operation
    }),
    deleteObject: vi.fn(async (request, options) => {
      const object = useWhiteboardStore.getState().objects[request.objectId]
      const baseObject = object ?? makeObject({ id: request.objectId })
      const resultingObject = makeObject({
        ...baseObject,
        id: request.objectId,
        roomId: request.roomId,
        deletedAt: baseObject.deletedAt ?? timestamp,
        version: baseObject.version + 1,
      })
      const operation = makeOperation({
        clientOpId: request.clientOpId,
        objectId: request.objectId,
        resultingObject,
        revision: useWhiteboardStore.getState().currentRevision + 1,
        roomId: request.roomId,
        type: "OBJECT_DELETE",
      })

      applyAcceptedOperation(operation, options)
      return operation
    }),
    undoOperation: vi.fn(async (request) => {
      const operation = makeOperationFromUndoRedoOperation(
        request.inverseOperation,
        request.clientOpId,
        request.roomId,
      )

      applyAcceptedOperation(operation, undefined)
      return operation
    }),
    redoOperation: vi.fn(async (request) => {
      const operation = makeOperationFromUndoRedoOperation(
        request.redoOperation,
        request.clientOpId,
        request.roomId,
      )

      applyAcceptedOperation(operation, undefined)
      return operation
    }),
  }

  useWhiteboardStore.getState().setObjectOperationSender(sender)
  return sender
}

function applyAcceptedOperation(
  operation: OperationAppliedEvent,
  options: WhiteboardOperationSenderOptions | undefined,
) {
  useWhiteboardStore.getState().applyOperation(operation, {
    removeObjectId: options?.tempObjectId,
    historyCandidate: options?.historyCandidate,
  })
}

function makeOperationFromUndoRedoOperation(
  undoRedoOperation: UndoRedoOperation,
  clientOpId: string,
  roomId: string,
): OperationAppliedEvent {
  const state = useWhiteboardStore.getState()

  switch (undoRedoOperation.type) {
    case "OBJECT_CREATE": {
      const resultingObject = makeObject({
        id: serverCreateObjectId,
        roomId,
        ...undoRedoOperation.object,
        rotation: undoRedoOperation.object.rotation ?? 0,
        style: undoRedoOperation.object.style ?? {},
        zIndex: undoRedoOperation.object.zIndex ?? 10,
        version: 1,
      })

      return makeOperation({
        clientOpId,
        roomId,
        objectId: resultingObject.id,
        resultingObject,
        revision: state.currentRevision + 1,
        type: "OBJECT_CREATE",
      })
    }
    case "OBJECT_UPDATE": {
      const object =
        state.objects[undoRedoOperation.objectId] ??
        makeObject({ id: undoRedoOperation.objectId, roomId })
      const resultingObject = makeObject({
        ...applyMutablePatchForTest(object, undoRedoOperation.patch),
        id: undoRedoOperation.objectId,
        roomId,
        version: object.version + 1,
      })

      return makeOperation({
        clientOpId,
        roomId,
        objectId: undoRedoOperation.objectId,
        resultingObject,
        revision: state.currentRevision + 1,
        type: "OBJECT_UPDATE",
      })
    }
    case "OBJECT_DELETE": {
      const object =
        state.objects[undoRedoOperation.objectId] ??
        makeObject({ id: undoRedoOperation.objectId, roomId })
      const resultingObject = makeObject({
        ...object,
        id: undoRedoOperation.objectId,
        roomId,
        deletedAt: object.deletedAt ?? timestamp,
        version: object.version + 1,
      })

      return makeOperation({
        clientOpId,
        roomId,
        objectId: undoRedoOperation.objectId,
        resultingObject,
        revision: state.currentRevision + 1,
        type: "OBJECT_DELETE",
      })
    }
    case "OBJECT_RESTORE": {
      const object =
        state.objects[undoRedoOperation.objectId] ??
        makeObject({ id: undoRedoOperation.objectId, roomId })
      const resultingObject = makeObject({
        ...object,
        id: undoRedoOperation.objectId,
        roomId,
        deletedAt: null,
        version: object.version + 1,
      })

      return makeOperation({
        clientOpId,
        roomId,
        objectId: undoRedoOperation.objectId,
        resultingObject,
        revision: state.currentRevision + 1,
        type: "OBJECT_RESTORE",
      })
    }
  }
}

function applyMutablePatchForTest(
  object: WhiteboardObject,
  patch: ObjectMutablePatch,
): WhiteboardObject {
  return {
    ...object,
    ...patch,
    style: patch.style
      ? {
          ...object.style,
          ...patch.style,
        }
      : object.style,
  }
}

function loadRoom(objects: WhiteboardObject[] = [], currentRevision = 0) {
  const input = makeLoadedRoomStateInput(objects, currentRevision)

  getRoomObjectsMock.mockResolvedValue({
    roomId: activeRoomId,
    currentRevision,
    objects,
  })
  useWhiteboardStore.getState().setRoomId(activeRoomId)
  useWhiteboardStore.getState().setLoadedRoomState(input)
  useWhiteboardStore.getState().setObjectOperationSender(null)
  useWhiteboardStore.getState().setSelectionSender(null)
}

function makeLoadedRoomStateInput(
  objects: WhiteboardObject[] = [],
  currentRevision = 0,
): Parameters<
  ReturnType<typeof useWhiteboardStore.getState>["setLoadedRoomState"]
>[0] {
  return {
    room: {
      id: activeRoomId,
      name: "History Room",
      currentRevision,
      isPublic: true,
      defaultJoinRole: "EDITOR",
    },
    currentUser: {
      ...actor,
      role: "EDITOR",
    },
    currentRevision,
    objects,
    onlineUsers: [],
  }
}

function makeObject(
  overrides: Partial<WhiteboardObject> = {},
): WhiteboardObject {
  return {
    id: objectId,
    roomId: activeRoomId,
    type: "RECTANGLE",
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    style: {
      fill: "#ffffff",
      stroke: "#111111",
      strokeWidth: 2,
      opacity: 1,
    },
    zIndex: 10,
    version: 1,
    createdById: actor.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function makeOperation(
  overrides: Partial<OperationAppliedEvent> = {},
): OperationAppliedEvent {
  const resultingObject =
    overrides.resultingObject === undefined
      ? makeObject({ id: overrides.objectId ?? objectId })
      : overrides.resultingObject

  return {
    operationId: uuid(401),
    clientOpId: "client-op",
    roomId: activeRoomId,
    revision: 1,
    type: "OBJECT_UPDATE",
    objectId,
    actor,
    payload: {},
    resultingObject,
    createdAt: timestamp,
    ...overrides,
  }
}

function makeHistoryEntry(
  overrides: Partial<WhiteboardHistoryEntry> = {},
): WhiteboardHistoryEntry {
  const object = makeObject({ id: overrides.objectId ?? objectId })

  return {
    operationId: uuid(501),
    clientOpId: "history-client-op",
    roomId: activeRoomId,
    revision: 1,
    type: "OBJECT_UPDATE",
    objectId: object.id,
    createdAt: timestamp,
    beforeObject: object,
    afterObject: makeObject({ id: object.id, x: object.x + 10 }),
    forwardAction: {
      type: "OBJECT_UPDATE",
      patch: {
        x: object.x + 10,
      },
    },
    ...overrides,
  }
}

function pushRedoEntry() {
  useWhiteboardStore.getState().pushUndoEntry(makeHistoryEntry())
  useWhiteboardStore.getState().moveLatestUndoEntryToRedo()
}

function expectHistoryToBeEmpty() {
  expect(useWhiteboardStore.getState().undoStack).toEqual([])
  expect(useWhiteboardStore.getState().redoStack).toEqual([])
}

async function waitFor(assertion: () => boolean) {
  for (let index = 0; index < 30; index += 1) {
    if (assertion()) {
      return
    }

    await flushAsync()
  }

  expect(assertion()).toBe(true)
}

async function flushAsync() {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
}
