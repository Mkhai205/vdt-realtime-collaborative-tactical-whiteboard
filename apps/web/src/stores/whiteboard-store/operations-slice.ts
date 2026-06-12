import type { StateCreator } from "zustand"
import type {
  ObjectMutablePatch,
  OperationAppliedEvent,
  OperationRejectedEvent,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type {
  WhiteboardState,
  LoadedRoomStateInput,
  WhiteboardApplyOperationOptions,
  LocalObjectInput,
  WhiteboardToast,
  WhiteboardToastVariant,
  RemoteTransformPreview,
  RemoteEditingState,
} from "./types"
import { getRoomObjects } from "@/features/whiteboard/whiteboard-api"
import {
  cloneWhiteboardObject,
  clearWhiteboardHistoryStacks,
  createRedoOperation,
  createRedoStackEntryAfterUndo,
  createUndoOperation,
  createUndoStackEntryAfterRedo,
  createWhiteboardHistoryEntry,
  moveLatestRedoToUndo,
  moveLatestUndoToRedo,
  pushUndoStackEntry,
  type PendingWhiteboardHistoryEntry,
  type WhiteboardHistoryEntry,
} from "@/features/whiteboard/whiteboard-history"
import { getCenteredViewport } from "@/lib/canvas-utils"
import { canEditRoom } from "@/features/whiteboard/whiteboard-ui-utils"
import {
  createDemoObjects,
  createLocalObjectRecord,
  applyMutablePatchToObject,
} from "@/features/whiteboard/whiteboard-helpers"
import { clearAllRemotePreviewTimeouts, clearRemotePreviewTimeout } from "./collaboration-slice"

const maxToastCount = 3
const objectVersionConflictToastMessage =
  "Object changed in another session. Refreshed to latest version."

let mutationQueue = Promise.resolve()

function enqueueMutation(task: () => Promise<void>) {
  mutationQueue = mutationQueue.then(task, task)
  void mutationQueue.catch(() => undefined)
}

function toObjectRecord(
  objects: WhiteboardObject[],
): Record<string, WhiteboardObject> {
  return Object.fromEntries(objects.map((object) => [object.id, object]))
}

function getNextZIndex(objects: Record<string, WhiteboardObject>): number {
  const maxZIndex = Object.values(objects)
    .filter((object) => !object.deletedAt)
    .reduce((max, object) => Math.max(max, object.zIndex), 0)

  return maxZIndex + 10
}

function removeRemoteTransformPreviews(
  previews: Record<string, RemoteTransformPreview>,
  objectIds: Array<string | null | undefined>,
): Record<string, RemoteTransformPreview> {
  const targetObjectIds = objectIds.filter(
    (objectId): objectId is string => Boolean(objectId),
  )

  if (targetObjectIds.length === 0) {
    return previews
  }

  let nextPreviews = previews

  for (const objectId of targetObjectIds) {
    if (!(objectId in nextPreviews)) {
      continue
    }

    if (nextPreviews === previews) {
      nextPreviews = { ...previews }
    }

    delete nextPreviews[objectId]
  }

  return nextPreviews
}

function removeRemoteEditorsForObjects(
  editors: Record<string, Record<string, RemoteEditingState>>,
  objectIds: Array<string | null | undefined>,
): Record<string, Record<string, RemoteEditingState>> {
  const targetObjectIds = objectIds.filter(
    (objectId): objectId is string => Boolean(objectId),
  )

  if (targetObjectIds.length === 0) {
    return editors
  }

  let nextEditors = editors

  for (const objectId of targetObjectIds) {
    if (!(objectId in nextEditors)) {
      continue
    }

    if (nextEditors === editors) {
      nextEditors = { ...editors }
    }

    delete nextEditors[objectId]
  }

  return nextEditors
}

function applyOperationToObjects(
  objects: Record<string, WhiteboardObject>,
  operation: OperationAppliedEvent,
  removeObjectId?: string,
): Record<string, WhiteboardObject> {
  const nextObjects = { ...objects }

  if (removeObjectId) {
    delete nextObjects[removeObjectId]
  }

  if (operation.resultingObject) {
    nextObjects[operation.resultingObject.id] = operation.resultingObject
  } else if (operation.type === "OBJECT_DELETE" && operation.objectId) {
    delete nextObjects[operation.objectId]
  }

  return nextObjects
}

function getMonotonicRevision(
  currentRevision: number,
  nextRevision: number | undefined,
): number {
  return nextRevision === undefined
    ? currentRevision
    : Math.max(currentRevision, nextRevision)
}

function toCreateRequestObject(input: LocalObjectInput, zIndex: number) {
  return {
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    points: input.points,
    text: input.text,
    rotation: input.rotation,
    style: input.style,
    zIndex,
  }
}

function getOperationRejection(error: unknown): OperationRejectedEvent | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "clientOpId" in error &&
    "roomId" in error &&
    "reason" in error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return error as OperationRejectedEvent
  }

  return null
}

function getWhiteboardOperationErrorMessage(error: unknown): string {
  const rejection = getOperationRejection(error)

  if (rejection) {
    return rejection.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Whiteboard operation failed."
}

function createWhiteboardToast(
  message: string,
  variant: WhiteboardToastVariant,
): WhiteboardToast {
  return {
    id: createToastId(),
    message,
    variant,
    createdAt: Date.now(),
  }
}

function createToastId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function appendWhiteboardToast(
  toasts: WhiteboardToast[],
  toast: WhiteboardToast,
): WhiteboardToast[] {
  return [...toasts, toast].slice(-maxToastCount)
}

async function handleOperationFailure(
  error: unknown,
  get: () => WhiteboardState,
  set: (
    partial:
      | Partial<WhiteboardState>
      | ((state: WhiteboardState) => Partial<WhiteboardState>),
  ) => void,
) {
  const rejection = getOperationRejection(error)

  if (rejection) {
    get().applyOperationRejection(rejection)

    if (rejection.latestObject) {
      return
    }
  } else {
    set({
      mutationError: getWhiteboardOperationErrorMessage(error),
    })
  }

  await reloadObjectsSafely(get().roomId, get().setObjectsWithRevision)
}

function handleUndoRedoOperationFailure(
  error: unknown,
  get: () => WhiteboardState,
  set: (
    partial:
      | Partial<WhiteboardState>
      | ((state: WhiteboardState) => Partial<WhiteboardState>),
  ) => void,
) {
  const rejection = getOperationRejection(error)

  if (rejection) {
    get().applyOperationRejection(rejection)
    return
  }

  set({
    mutationError: getWhiteboardOperationErrorMessage(error),
  })
}

async function reloadObjectsSafely(
  roomId: string | null,
  setObjectsWithRevision: WhiteboardState["setObjectsWithRevision"],
) {
  if (!roomId) {
    return
  }

  try {
    const response = await getRoomObjects(roomId)
    setObjectsWithRevision(response.objects, response.currentRevision)
  } catch {
    // Keep original mutation error visible if reload also fails
  }
}

export type OperationsSlice = {
  setRoomId: (roomId: string) => void
  selectObject: (objectId: string | null) => void
  setTool: (tool: WhiteboardState["currentTool"]) => void
  setLoadedRoomState: (input: LoadedRoomStateInput) => void
  setConnectionStatus: (status: WhiteboardState["connectionStatus"]) => void
  setSocketError: (message: string | null) => void
  setMutationError: (message: string | null) => void
  dismissToast: (toastId: string) => void
  setObjects: (objects: WhiteboardObject[]) => void
  setObjectsWithRevision: (objects: WhiteboardObject[], currentRevision: number) => void
  markRevisionSynced: (revision: number) => void
  upsertObject: (object: WhiteboardObject) => void
  applyOperation: (operation: OperationAppliedEvent, options?: WhiteboardApplyOperationOptions) => void
  applyOperationRejection: (rejection: OperationRejectedEvent) => void
  pushUndoEntry: (entry: WhiteboardHistoryEntry) => void
  moveLatestUndoEntryToRedo: () => WhiteboardHistoryEntry | null
  moveLatestRedoEntryToUndo: () => WhiteboardHistoryEntry | null
  clearHistoryStacks: () => void
  undoLastOperation: () => void
  redoLastOperation: () => void
  updateObjectPatch: (objectId: string, patch: ObjectMutablePatch) => void
  removeObject: (objectId: string) => void
  deleteSelectedObject: () => void
  createLocalObject: (input: LocalObjectInput) => WhiteboardObject | null
  seedDemoObjects: (roomId: string) => void
}

export const createOperationsSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  OperationsSlice
> = (set, get) => ({
  setRoomId: (roomId) => {
    if (get().roomId !== roomId) {
      clearAllRemotePreviewTimeouts()
    }

    set((state) => {
      if (state.roomId === roomId) {
        return state
      }

      return {
        roomId,
        room: null,
        currentUser: null,
        currentRevision: 0,
        lastSeenRevision: 0,
        connectionStatus: "idle",
        socketError: null,
        onlineUsers: [],
        mutationError: null,
        toasts: [],
        objects: {},
        remoteCursors: {},
        remoteEditors: {},
        remoteTransformPreviews: {},
        appliedClientOpIds: {},
        undoStack: [],
        redoStack: [],
        selectedObjectId: null,
        currentTool: "SELECT",
        toolRevision: state.toolRevision + 1,
        objectOperationSender: null,
        transformPreviewSender: null,
        cursorSender: null,
        editingSender: null,
        selectionSender: null,
        viewport: getCenteredViewport(state.stageSize),
      }
    })
  },
  selectObject: (objectId) => {
    let nextSelectedObjectId: string | null | undefined

    set((state) => {
      if (!objectId) {
        if (state.selectedObjectId === null) {
          return state
        }

        nextSelectedObjectId = null
        return { selectedObjectId: null }
      }

      const object = state.objects[objectId]

      if (!object || object.deletedAt || state.selectedObjectId === objectId) {
        return state
      }

      nextSelectedObjectId = objectId
      return { selectedObjectId: objectId }
    })

    if (nextSelectedObjectId !== undefined) {
      get().sendSelectionUpdate(nextSelectedObjectId)
    }
  },
  setTool: (tool) =>
    set((state) =>
      state.currentTool === tool
        ? state
        : {
            currentTool: tool,
            toolRevision: state.toolRevision + 1,
          },
    ),
  setLoadedRoomState: (input) => {
    clearAllRemotePreviewTimeouts()

    let shouldBroadcastSelectionReset = false

    set((state) => {
      const nextObjects = toObjectRecord(input.objects)
      shouldBroadcastSelectionReset = state.selectedObjectId !== null

      return {
        roomId: input.room.id,
        room: input.room,
        currentUser: input.currentUser,
        currentRevision: input.currentRevision,
        lastSeenRevision: input.currentRevision,
        connectionStatus: "connected",
        socketError: null,
        onlineUsers: input.onlineUsers ?? state.onlineUsers,
        mutationError: null,
        objects: nextObjects,
        remoteCursors: {},
        remoteEditors: {},
        remoteTransformPreviews: {},
        appliedClientOpIds: {},
        undoStack: [],
        redoStack: [],
        selectedObjectId: null,
        currentTool: canEditRoom(input.currentUser.role)
          ? state.currentTool
          : "SELECT",
      }
    })

    if (shouldBroadcastSelectionReset) {
      get().sendSelectionUpdate(null)
    }
  },
  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
    }),
  setSocketError: (message) =>
    set({
      socketError: message,
    }),
  setMutationError: (message) =>
    set({
      mutationError: message,
    }),
  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
  setObjects: (objects) => {
    clearAllRemotePreviewTimeouts()

    let shouldBroadcastSelectionReset = false

    set((state) => {
      const nextObjects = toObjectRecord(objects)
      shouldBroadcastSelectionReset = state.selectedObjectId !== null

      return {
        objects: nextObjects,
        remoteEditors: {},
        remoteTransformPreviews: {},
        undoStack: [],
        redoStack: [],
        selectedObjectId: null,
      }
    })

    if (shouldBroadcastSelectionReset) {
      get().sendSelectionUpdate(null)
    }
  },
  setObjectsWithRevision: (objects, currentRevision) => {
    clearAllRemotePreviewTimeouts()

    let shouldBroadcastSelectionReset = false

    set((state) => {
      const nextObjects = toObjectRecord(objects)
      shouldBroadcastSelectionReset = state.selectedObjectId !== null

      return {
        objects: nextObjects,
        remoteEditors: {},
        remoteTransformPreviews: {},
        currentRevision,
        lastSeenRevision: currentRevision,
        undoStack: [],
        redoStack: [],
        selectedObjectId: null,
      }
    })

    if (shouldBroadcastSelectionReset) {
      get().sendSelectionUpdate(null)
    }
  },
  markRevisionSynced: (revision) =>
    set((state) => ({
      currentRevision: getMonotonicRevision(state.currentRevision, revision),
      lastSeenRevision: getMonotonicRevision(state.lastSeenRevision, revision),
    })),
  upsertObject: (object) =>
    set((state) => ({
      objects: {
        ...state.objects,
        [object.id]: object,
      },
    })),
  applyOperation: (operation, options) => {
    clearRemotePreviewTimeout(operation.objectId ?? undefined)
    clearRemotePreviewTimeout(operation.resultingObject?.id)

    let nextSelectedObjectId: string | null | undefined

    set((state) => {
      if (state.roomId !== operation.roomId) {
        return state
      }

      const nextRemoteTransformPreviews = removeRemoteTransformPreviews(
        state.remoteTransformPreviews,
        [operation.objectId, operation.resultingObject?.id],
      )
      const deletedObjectId =
        operation.type === "OBJECT_DELETE"
          ? operation.objectId
          : operation.resultingObject?.deletedAt
            ? operation.resultingObject.id
            : null
      const nextRemoteEditors = removeRemoteEditorsForObjects(
        state.remoteEditors,
        [deletedObjectId, options?.removeObjectId],
      )

      if (
        state.appliedClientOpIds[operation.clientOpId] ||
        operation.revision <= state.lastSeenRevision
      ) {
        return nextRemoteTransformPreviews === state.remoteTransformPreviews &&
          nextRemoteEditors === state.remoteEditors
          ? state
          : {
              remoteEditors: nextRemoteEditors,
              remoteTransformPreviews: nextRemoteTransformPreviews,
            }
      }

      const nextObjects = applyOperationToObjects(
        state.objects,
        operation,
        options?.removeObjectId,
      )
      const historyEntry = createWhiteboardHistoryEntry(
        operation,
        options?.historyCandidate,
      )
      const historyStacks = historyEntry
        ? pushUndoStackEntry(state.undoStack, historyEntry)
        : {
            undoStack: state.undoStack,
            redoStack: state.redoStack,
          }
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null
      const resolvedSelectedObjectId =
        selectedObject && !selectedObject.deletedAt
          ? state.selectedObjectId
          : null

      if (resolvedSelectedObjectId !== state.selectedObjectId) {
        nextSelectedObjectId = resolvedSelectedObjectId
      }

      return {
        objects: nextObjects,
        appliedClientOpIds: {
          ...state.appliedClientOpIds,
          [operation.clientOpId]: true,
        },
        currentRevision: getMonotonicRevision(
          state.currentRevision,
          operation.revision,
        ),
        lastSeenRevision: getMonotonicRevision(
          state.lastSeenRevision,
          operation.revision,
        ),
        mutationError: null,
        remoteEditors: nextRemoteEditors,
        remoteTransformPreviews: nextRemoteTransformPreviews,
        undoStack: historyStacks.undoStack,
        redoStack: historyStacks.redoStack,
        selectedObjectId: resolvedSelectedObjectId,
      }
    })

    if (nextSelectedObjectId !== undefined) {
      get().sendSelectionUpdate(nextSelectedObjectId)
    }
  },
  applyOperationRejection: (rejection) => {
    let nextSelectedObjectId: string | null | undefined

    set((state) => {
      if (state.roomId !== rejection.roomId) {
        return state
      }

      if (!rejection.latestObject) {
        return {
          mutationError: rejection.message,
          currentRevision: getMonotonicRevision(
            state.currentRevision,
            rejection.currentRoomRevision,
          ),
        }
      }

      const nextObjects = {
        ...state.objects,
        [rejection.latestObject.id]: rejection.latestObject,
      }
      const showConflictToast = rejection.reason === "OBJECT_VERSION_CONFLICT"
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null
      const resolvedSelectedObjectId =
        selectedObject && !selectedObject.deletedAt
          ? state.selectedObjectId
          : null

      if (resolvedSelectedObjectId !== state.selectedObjectId) {
        nextSelectedObjectId = resolvedSelectedObjectId
      }

      return {
        objects: nextObjects,
        currentRevision: getMonotonicRevision(
          state.currentRevision,
          rejection.currentRoomRevision,
        ),
        mutationError: showConflictToast ? null : rejection.message,
        remoteEditors: rejection.latestObject.deletedAt
          ? removeRemoteEditorsForObjects(state.remoteEditors, [
              rejection.latestObject.id,
            ])
          : state.remoteEditors,
        toasts: showConflictToast
          ? appendWhiteboardToast(
              state.toasts,
              createWhiteboardToast(
                objectVersionConflictToastMessage,
                "info",
              ),
            )
          : state.toasts,
        selectedObjectId: resolvedSelectedObjectId,
      }
    })

    if (nextSelectedObjectId !== undefined) {
      get().sendSelectionUpdate(nextSelectedObjectId)
    }
  },
  pushUndoEntry: (entry) =>
    set((state) => pushUndoStackEntry(state.undoStack, entry)),
  moveLatestUndoEntryToRedo: () => {
    let movedEntry: WhiteboardHistoryEntry | null = null

    set((state) => {
      const result = moveLatestUndoToRedo(state.undoStack, state.redoStack)
      movedEntry = result.movedEntry

      return {
        undoStack: result.undoStack,
        redoStack: result.redoStack,
      }
    })

    return movedEntry
  },
  moveLatestRedoEntryToUndo: () => {
    let movedEntry: WhiteboardHistoryEntry | null = null

    set((state) => {
      const result = moveLatestRedoToUndo(state.undoStack, state.redoStack)
      movedEntry = result.movedEntry

      return {
        undoStack: result.undoStack,
        redoStack: result.redoStack,
      }
    })

    return movedEntry
  },
  clearHistoryStacks: () => set(clearWhiteboardHistoryStacks()),
  undoLastOperation: () => {
    const state = get()

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot undo whiteboard operations.",
      })
      return
    }

    if (!state.roomId || !state.objectOperationSender) {
      set({
        mutationError: "Realtime connection is not ready.",
      })
      return
    }

    if (state.undoStack.length === 0) {
      return
    }

    enqueueMutation(async () => {
      const queuedState = get()
      const entry = queuedState.undoStack.at(-1)
      const inverseOperation = entry ? createUndoOperation(entry) : null

      if (!entry || !inverseOperation) {
        return
      }

      if (!queuedState.roomId || !queuedState.objectOperationSender) {
        set({
          mutationError: "Realtime connection is not ready.",
        })
        return
      }

      try {
        const operation = await queuedState.objectOperationSender.undoOperation({
          roomId: queuedState.roomId,
          clientOpId: crypto.randomUUID(),
          inverseOperation,
        })

        set((currentState) => {
          const latestEntry = currentState.undoStack.at(-1)

          if (!latestEntry || latestEntry.operationId !== entry.operationId) {
            return currentState
          }

          const redoEntry = createRedoStackEntryAfterUndo(
            latestEntry,
            operation,
          )

          if (!redoEntry) {
            return {
              mutationError: "Undo succeeded, but redo cannot be prepared.",
            }
          }

          return {
            undoStack: currentState.undoStack.slice(0, -1),
            redoStack: [...currentState.redoStack, redoEntry],
            mutationError: null,
          }
        })
      } catch (error) {
        handleUndoRedoOperationFailure(error, get, set)
      }
    })
  },
  redoLastOperation: () => {
    const state = get()

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot redo whiteboard operations.",
      })
      return
    }

    if (!state.roomId || !state.objectOperationSender) {
      set({
        mutationError: "Realtime connection is not ready.",
      })
      return
    }

    if (state.redoStack.length === 0) {
      return
    }

    enqueueMutation(async () => {
      const queuedState = get()
      const entry = queuedState.redoStack.at(-1)
      const redoOperation = entry ? createRedoOperation(entry) : null

      if (!entry || !redoOperation) {
        return
      }

      if (!queuedState.roomId || !queuedState.objectOperationSender) {
        set({
          mutationError: "Realtime connection is not ready.",
        })
        return
      }

      try {
        const operation = await queuedState.objectOperationSender.redoOperation({
          roomId: queuedState.roomId,
          clientOpId: crypto.randomUUID(),
          redoOperation,
        })

        set((currentState) => {
          const latestEntry = currentState.redoStack.at(-1)

          if (!latestEntry || latestEntry.operationId !== entry.operationId) {
            return currentState
          }

          const undoEntry = createUndoStackEntryAfterRedo(
            latestEntry,
            operation,
          )

          if (!undoEntry) {
            return {
              mutationError: "Redo succeeded, but undo cannot be prepared.",
            }
          }

          return {
            undoStack: [...currentState.undoStack, undoEntry],
            redoStack: currentState.redoStack.slice(0, -1),
            mutationError: null,
          }
        })
      } catch (error) {
        handleUndoRedoOperationFailure(error, get, set)
      }
    })
  },
  updateObjectPatch: (objectId, patch) => {
    const state = get()

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot edit whiteboard objects.",
      })
      return
    }

    const objectBeforeUpdate = state.objects[objectId]

    if (!objectBeforeUpdate || objectBeforeUpdate.deletedAt) {
      return
    }

    const objectAfterUpdate = applyMutablePatchToObject(
      objectBeforeUpdate,
      patch,
    )
    const clientOpId = crypto.randomUUID()
    const historyCandidate: PendingWhiteboardHistoryEntry = {
      type: "OBJECT_UPDATE",
      objectId,
      beforeObject: cloneWhiteboardObject(objectBeforeUpdate),
      afterObject: cloneWhiteboardObject(objectAfterUpdate),
      forwardAction: {
        type: "OBJECT_UPDATE",
        patch,
      },
    }

    set((currentState) => {
      return {
        objects: {
          ...currentState.objects,
          [objectId]: objectAfterUpdate,
        },
      }
    })

    enqueueMutation(async () => {
      const queuedState = get()
      const object = queuedState.objects[objectId]

      if (!queuedState.roomId || !object || object.deletedAt) {
        return
      }

      try {
        const sender = queuedState.objectOperationSender

        if (!sender) {
          throw new Error("Realtime connection is not ready.")
        }

        await sender.updateObject({
          roomId: queuedState.roomId,
          objectId,
          clientOpId,
          baseRoomRevision: queuedState.currentRevision,
          baseObjectVersion: object.version,
          patch,
        }, {
          historyCandidate,
        })
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })
  },
  removeObject: (objectId) => {
    clearRemotePreviewTimeout(objectId)

    let nextSelectedObjectId: string | null | undefined

    set((state) => {
      const nextObjects = { ...state.objects }
      const nextRemoteTransformPreviews = {
        ...state.remoteTransformPreviews,
      }
      delete nextObjects[objectId]
      delete nextRemoteTransformPreviews[objectId]
      const resolvedSelectedObjectId =
        state.selectedObjectId === objectId ? null : state.selectedObjectId

      if (resolvedSelectedObjectId !== state.selectedObjectId) {
        nextSelectedObjectId = resolvedSelectedObjectId
      }

      return {
        objects: nextObjects,
        remoteEditors: removeRemoteEditorsForObjects(state.remoteEditors, [
          objectId,
        ]),
        remoteTransformPreviews: nextRemoteTransformPreviews,
        selectedObjectId: resolvedSelectedObjectId,
      }
    })

    if (nextSelectedObjectId !== undefined) {
      get().sendSelectionUpdate(nextSelectedObjectId)
    }
  },
  deleteSelectedObject: () => {
    const state = get()
    const selectedObjectId = state.selectedObjectId

    if (!selectedObjectId) {
      return
    }

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot delete whiteboard objects.",
      })
      return
    }

    const selectedObject = state.objects[selectedObjectId]

    if (!selectedObject || selectedObject.deletedAt) {
      set({
        selectedObjectId: null,
      })
      get().sendSelectionUpdate(null)
      return
    }

    clearRemotePreviewTimeout(selectedObjectId)

    const deletedObject = {
      ...selectedObject,
      deletedAt: new Date().toISOString(),
    }
    const clientOpId = crypto.randomUUID()
    const historyCandidate: PendingWhiteboardHistoryEntry = {
      type: "OBJECT_DELETE",
      objectId: selectedObjectId,
      beforeObject: cloneWhiteboardObject(selectedObject),
      afterObject: cloneWhiteboardObject(deletedObject),
      forwardAction: {
        type: "OBJECT_DELETE",
      },
    }

    set((currentState) => ({
      objects: {
        ...currentState.objects,
        [selectedObjectId]: deletedObject,
      },
      remoteTransformPreviews: removeRemoteTransformPreviews(
        currentState.remoteTransformPreviews,
        [selectedObjectId],
      ),
      remoteEditors: removeRemoteEditorsForObjects(
        currentState.remoteEditors,
        [selectedObjectId],
      ),
      selectedObjectId: null,
    }))
    get().sendSelectionUpdate(null)

    enqueueMutation(async () => {
      const queuedState = get()
      const object = queuedState.objects[selectedObjectId] ?? selectedObject

      if (!queuedState.roomId) {
        return
      }

      try {
        const sender = queuedState.objectOperationSender

        if (!sender) {
          throw new Error("Realtime connection is not ready.")
        }

        await sender.deleteObject({
          roomId: queuedState.roomId,
          objectId: selectedObjectId,
          clientOpId,
          baseRoomRevision: queuedState.currentRevision,
          baseObjectVersion: object.version,
        }, {
          historyCandidate,
        })
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })
  },
  createLocalObject: (input) => {
    const state = get()

    if (!state.roomId) {
      return null
    }

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot create whiteboard objects.",
      })
      return null
    }

    const zIndex = getNextZIndex(state.objects)
    const object = createLocalObjectRecord(
      state.roomId,
      input,
      zIndex,
    )
    const clientOpId = crypto.randomUUID()
    const requestObject = toCreateRequestObject(input, zIndex)
    const historyCandidate: PendingWhiteboardHistoryEntry = {
      type: "OBJECT_CREATE",
      objectId: object.id,
      beforeObject: null,
      afterObject: cloneWhiteboardObject(object),
      forwardAction: {
        type: "OBJECT_CREATE",
        object: requestObject,
      },
    }

    set((currentState) => ({
      objects: {
        ...currentState.objects,
        [object.id]: object,
      },
    }))

    enqueueMutation(async () => {
      const queuedState = get()

      if (!queuedState.roomId) {
        return
      }

      try {
        const sender = queuedState.objectOperationSender

        if (!sender) {
          throw new Error("Realtime connection is not ready.")
        }

        await sender.createObject({
          roomId: queuedState.roomId,
          clientOpId,
          baseRoomRevision: queuedState.currentRevision,
          object: requestObject,
        }, {
          tempObjectId: object.id,
          historyCandidate,
        })
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })

    return object
  },
  seedDemoObjects: (roomId) =>
    set((state) => {
      const hasRoomObjects = Object.values(state.objects).some(
        (object) => object.roomId === roomId && !object.deletedAt,
      )

      if (hasRoomObjects) {
        return state
      }

      return {
        objects: toObjectRecord(createDemoObjects(roomId)),
      }
    }),
})
