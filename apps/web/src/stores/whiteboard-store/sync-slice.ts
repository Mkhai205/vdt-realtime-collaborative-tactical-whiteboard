import type { StateCreator } from "zustand"
import type {
  WhiteboardObject,
  OperationAppliedEvent,
  OperationRejectedEvent,
} from "@rctw/shared-contracts"
import type {
  WhiteboardState,
  LoadedRoomStateInput,
  WhiteboardApplyOperationOptions,
} from "./types"
import { canEditRoom } from "@/lib/room-utils"
import {
  clearAllRemotePreviewTimeouts,
  clearRemotePreviewTimeout,
} from "./collaboration-slice"
import {
  toObjectRecord,
  getMonotonicRevision,
  removeRemoteTransformPreviews,
  removeRemoteEditorsForObjects,
  applyOperationToObjects,
  appendWhiteboardToast,
  createWhiteboardToast,
  objectVersionConflictToastMessage,
} from "./helpers"
import {
  createWhiteboardHistoryEntry,
  pushUndoStackEntry,
} from "@/lib/whiteboard-history"

export type SyncSlice = {
  setLoadedRoomState: (input: LoadedRoomStateInput) => void
  setConnectionStatus: (status: WhiteboardState["connectionStatus"]) => void
  setSocketError: (message: string | null) => void
  setObjects: (objects: WhiteboardObject[]) => void
  setObjectsWithRevision: (
    objects: WhiteboardObject[],
    currentRevision: number,
  ) => void
  markRevisionSynced: (revision: number) => void
  upsertObject: (object: WhiteboardObject) => void
  applyOperation: (
    operation: OperationAppliedEvent,
    options?: WhiteboardApplyOperationOptions,
  ) => void
  applyOperationRejection: (rejection: OperationRejectedEvent) => void
}

export const createSyncSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  SyncSlice
> = (set, get) => ({
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
              createWhiteboardToast(objectVersionConflictToastMessage, "info"),
            )
          : state.toasts,
        selectedObjectId: resolvedSelectedObjectId,
      }
    })

    if (nextSelectedObjectId !== undefined) {
      get().sendSelectionUpdate(nextSelectedObjectId)
    }
  },
})
