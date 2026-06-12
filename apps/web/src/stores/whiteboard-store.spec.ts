import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  CursorUpdatedEvent,
  ObjectEditingEvent,
  ObjectTransformPreviewedEvent,
  OperationAppliedEvent,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import { getRoomObjects } from "@/features/whiteboard/whiteboard-api"
import type { WhiteboardHistoryEntry } from "@/features/whiteboard/whiteboard-history"
import {
  type WhiteboardSelectionSender,
  useWhiteboardStore,
} from "./whiteboard-store"

vi.mock("@/features/whiteboard/whiteboard-api", () => ({
  getRoomObjects: vi.fn(),
}))

const actor: UserSummary = {
  id: uuid(1),
  name: "Planner One",
  avatarColor: "#3B82F6",
}

const remoteUser: UserSummary = {
  id: uuid(2),
  name: "Planner Two",
  avatarColor: "#16A34A",
}

const objectId = uuid(201)
const timestamp = "2026-06-12T00:00:00.000Z"
const getRoomObjectsMock = vi.mocked(getRoomObjects)

let roomCounter = 100
let activeRoomId = uuid(roomCounter)

describe("whiteboard room state loading", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeRoomId = uuid(roomCounter++)
    useWhiteboardStore.getState().setRoomId(activeRoomId)
    useWhiteboardStore.getState().setSelectionSender(null)
  })

  it("loads room snapshot objects and current revision", () => {
    const firstObject = makeObject({ id: objectId, zIndex: 10 })
    const secondObject = makeObject({ id: uuid(202), zIndex: 20 })

    useWhiteboardStore.getState().setConnectionStatus("connecting")
    useWhiteboardStore
      .getState()
      .setLoadedRoomState(makeLoadedRoomStateInput([firstObject, secondObject], 12))

    const state = useWhiteboardStore.getState()

    expect(state.roomId).toBe(activeRoomId)
    expect(state.room?.currentRevision).toBe(12)
    expect(state.currentRevision).toBe(12)
    expect(state.connectionStatus).toBe("connected")
    expect(state.objects[firstObject.id]).toEqual(firstObject)
    expect(state.objects[secondObject.id]).toEqual(secondObject)
  })

  it("clears selected object on room snapshot reload and broadcasts the reset", () => {
    const object = makeObject({ id: objectId })
    const selectionSender = makeSelectionSender()

    loadRoom([object], 1)
    useWhiteboardStore.getState().setSelectionSender(selectionSender)
    useWhiteboardStore.getState().selectObject(object.id)
    selectionSender.sendSelectionUpdate.mockClear()

    useWhiteboardStore
      .getState()
      .setLoadedRoomState(makeLoadedRoomStateInput([object], 2))

    expect(useWhiteboardStore.getState().selectedObjectId).toBeNull()
    expect(selectionSender.sendSelectionUpdate).toHaveBeenCalledTimes(1)
    expect(selectionSender.sendSelectionUpdate).toHaveBeenCalledWith({
      roomId: activeRoomId,
      selectedObjectId: null,
    })
  })

  it("does not broadcast a selection reset when no object was selected", () => {
    const object = makeObject({ id: objectId })
    const selectionSender = makeSelectionSender()

    loadRoom([object], 1)
    useWhiteboardStore.getState().setSelectionSender(selectionSender)

    useWhiteboardStore
      .getState()
      .setLoadedRoomState(makeLoadedRoomStateInput([object], 2))

    expect(useWhiteboardStore.getState().selectedObjectId).toBeNull()
    expect(selectionSender.sendSelectionUpdate).not.toHaveBeenCalled()
  })

  it("clears transient collaboration state and history on room snapshot reload", () => {
    const object = makeObject({ id: objectId, version: 1 })

    loadRoom([object], 1)
    useWhiteboardStore.getState().applyOperation(
      makeOperation({
        clientOpId: "applied-client-op",
        objectId,
        revision: 2,
        resultingObject: makeObject({ id: objectId, version: 2 }),
      }),
    )
    seedTransientCollaborationState(object)
    useWhiteboardStore.getState().pushUndoEntry(makeHistoryEntry({ objectId }))
    useWhiteboardStore.getState().pushUndoEntry(makeHistoryEntry({ objectId }))
    useWhiteboardStore.getState().moveLatestUndoEntryToRedo()

    expect(Object.keys(useWhiteboardStore.getState().remoteCursors)).toHaveLength(1)
    expect(Object.keys(useWhiteboardStore.getState().remoteEditors)).toHaveLength(1)
    expect(
      Object.keys(useWhiteboardStore.getState().remoteTransformPreviews),
    ).toHaveLength(1)
    expect(Object.keys(useWhiteboardStore.getState().appliedClientOpIds)).toEqual([
      "applied-client-op",
    ])
    expect(useWhiteboardStore.getState().undoStack.length).toBeGreaterThan(0)
    expect(useWhiteboardStore.getState().redoStack.length).toBeGreaterThan(0)

    useWhiteboardStore
      .getState()
      .setLoadedRoomState(makeLoadedRoomStateInput([object], 8))

    const state = useWhiteboardStore.getState()

    expect(state.remoteCursors).toEqual({})
    expect(state.remoteEditors).toEqual({})
    expect(state.remoteTransformPreviews).toEqual({})
    expect(state.appliedClientOpIds).toEqual({})
    expect(state.undoStack).toEqual([])
    expect(state.redoStack).toEqual([])
  })

  it("replaces objects and revision without leaving a selected object on full-state reload", () => {
    const object = makeObject({ id: objectId, x: 10, version: 1 })
    const reloadedObject = makeObject({ id: objectId, x: 42, version: 3 })
    const selectionSender = makeSelectionSender()

    loadRoom([object], 3)
    useWhiteboardStore.getState().setSelectionSender(selectionSender)
    useWhiteboardStore.getState().selectObject(object.id)
    selectionSender.sendSelectionUpdate.mockClear()

    useWhiteboardStore.getState().setObjectsWithRevision([reloadedObject], 9)

    const state = useWhiteboardStore.getState()

    expect(state.currentRevision).toBe(9)
    expect(state.objects).toEqual({
      [reloadedObject.id]: reloadedObject,
    })
    expect(state.selectedObjectId).toBeNull()
    expect(selectionSender.sendSelectionUpdate).toHaveBeenCalledWith({
      roomId: activeRoomId,
      selectedObjectId: null,
    })
  })
})

function loadRoom(objects: WhiteboardObject[] = [], currentRevision = 0) {
  getRoomObjectsMock.mockResolvedValue({
    roomId: activeRoomId,
    currentRevision,
    objects,
  })
  useWhiteboardStore
    .getState()
    .setLoadedRoomState(makeLoadedRoomStateInput(objects, currentRevision))
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
      name: "Operations Room",
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
    updatedById: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ...overrides,
  }
}

function makeOperation(
  overrides: Partial<OperationAppliedEvent> = {},
): OperationAppliedEvent {
  return {
    operationId: uuid(401),
    clientOpId: "client-op",
    roomId: activeRoomId,
    revision: 1,
    type: "OBJECT_UPDATE",
    objectId,
    actor,
    payload: {},
    resultingObject: makeObject({ id: objectId }),
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

function seedTransientCollaborationState(object: WhiteboardObject) {
  useWhiteboardStore.getState().applyRemoteCursor(makeCursorEvent())
  useWhiteboardStore.getState().applyRemoteEditing(makeEditingEvent(object.id))
  useWhiteboardStore
    .getState()
    .applyRemoteTransformPreview(makeTransformPreviewEvent(object.id))
}

function makeCursorEvent(): CursorUpdatedEvent {
  return {
    roomId: activeRoomId,
    user: remoteUser,
    x: 120,
    y: 240,
    selectedObjectId: objectId,
    currentTool: "SELECT",
    timestamp,
  }
}

function makeEditingEvent(objectIdValue: string): ObjectEditingEvent {
  return {
    roomId: activeRoomId,
    objectId: objectIdValue,
    user: remoteUser,
    status: "STARTED",
    timestamp,
  }
}

function makeTransformPreviewEvent(
  objectIdValue: string,
): ObjectTransformPreviewedEvent {
  return {
    roomId: activeRoomId,
    objectId: objectIdValue,
    user: remoteUser,
    preview: {
      x: 24,
      y: 48,
    },
    timestamp,
  }
}

function makeSelectionSender() {
  return {
    sendSelectionUpdate:
      vi.fn<WhiteboardSelectionSender["sendSelectionUpdate"]>(),
  } satisfies WhiteboardSelectionSender
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
}
