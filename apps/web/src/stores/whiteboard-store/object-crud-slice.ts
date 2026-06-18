import type { StateCreator } from "zustand"
import type {
  ObjectMutablePatch,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type { WhiteboardState, LocalObjectInput } from "./types"
import { canEditRoom } from "@/lib/room-utils"
import {
  applyMutablePatchToObject,
} from "@/components/features/whiteboard/whiteboard-helpers"
import {
  createDemoObjects,
  createLocalObjectRecord,
} from "@/lib/object-factory"
import { cloneWhiteboardObject, PendingWhiteboardHistoryEntry } from "@/lib/whiteboard-history"
import { clearRemotePreviewTimeout } from "./collaboration-slice"
import {
  toObjectRecord,
  getNextZIndex,
  toCreateRequestObject,
  removeRemoteTransformPreviews,
  removeRemoteEditorsForObjects,
  enqueueMutation,
  handleOperationFailure,
} from "./helpers"

export type ObjectCrudSlice = {
  updateObjectPatch: (objectId: string, patch: ObjectMutablePatch) => void
  removeObject: (objectId: string) => void
  deleteSelectedObject: () => void
  createLocalObject: (input: LocalObjectInput) => WhiteboardObject | null
  seedDemoObjects: (roomId: string) => void
}

export const createObjectCrudSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  ObjectCrudSlice
> = (set, get) => ({
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

        await sender.updateObject(
          {
            boardId: queuedState.roomId,
            objectId,
            clientOpId,
            baseRoomRevision: queuedState.currentRevision,
            baseObjectVersion: object.version,
            patch,
          },
          {
            historyCandidate,
          },
        )
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
      remoteEditors: removeRemoteEditorsForObjects(currentState.remoteEditors, [
        selectedObjectId,
      ]),
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

        await sender.deleteObject(
          {
            boardId: queuedState.roomId,
            objectId: selectedObjectId,
            clientOpId,
            baseRoomRevision: queuedState.currentRevision,
            baseObjectVersion: object.version,
          },
          {
            historyCandidate,
          },
        )
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
      state.currentUser?.id ?? "local-fallback",
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

        await sender.createObject(
          {
            boardId: queuedState.roomId,
            clientOpId,
            baseRoomRevision: queuedState.currentRevision,
            object: requestObject,
          },
          {
            tempObjectId: object.id,
            historyCandidate,
          },
        )
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })

    return object
  },
  seedDemoObjects: (roomId) =>
    set((state) => {
      const hasRoomObjects = Object.values(state.objects).some(
        (object) => object.boardId === roomId && !object.deletedAt,
      )

      if (hasRoomObjects) {
        return state
      }

      return {
        objects: toObjectRecord(createDemoObjects(roomId)),
      }
    }),
})
