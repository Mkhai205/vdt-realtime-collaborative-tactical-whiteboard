"use client"

import { useEffect } from "react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { getSocket } from "@/lib/socket/socket"
import { ServerEvents, ClientEvents } from "@rctw/shared-contracts"
import type {
  BoardStateEvent,
  ObjectCreatedAck,
  ObjectCreatedEvent,
  ObjectUpdatedAck,
  ObjectUpdatedEvent,
  ObjectDeletedAck,
  ObjectDeletedEvent,
  UndoRedoEvent,
  PresenceUpdateEvent,
  ObjectEditingEvent,
  WsErrorPayload,
  ObjectMoveEphemeralEvent,
} from "@rctw/shared-contracts"
import { toast } from "sonner"
import { discardedLocalOps } from "./useObjectMutations"

export function useBoardEvents(boardId: string) {
  const {
    initBoard,
    upsertObject,
    removeObject,
    applyUndoRedo,
    updatePresence,
    setEditingState,
    commitPendingOp,
    rollbackPendingOp,
    revision,
    updateObjectFields,
  } = useBoardStore()

  useEffect(() => {
    const socket = getSocket()

    // ─── 1. Board State on Join ───────────────────────────────────────────────
    const handleBoardState = (event: BoardStateEvent) => {
      initBoard(event)
    }

    // ─── 2. Object Created ─────────────────────────────────────────────────────
    const handleObjectCreatedAck = (event: ObjectCreatedAck) => {
      if (discardedLocalOps.has(event.clientOpId)) {
        discardedLocalOps.delete(event.clientOpId)
        return
      }
      const tempId = `local-${event.clientOpId}`
      // Remove local optimistic temp object
      removeObject(tempId)
      // Upsert real object from server
      upsertObject(event.object)
      // Commit optimistic op
      commitPendingOp(event.clientOpId)

      // Keep selection state in sync
      const { selectedIds, setSelectedIds } = useUIStore.getState()
      if (selectedIds.has(tempId)) {
        const next = new Set(selectedIds)
        next.delete(tempId)
        next.add(event.object.id)
        setSelectedIds(next)
      }
    }

    const handleObjectCreated = (event: ObjectCreatedEvent) => {
      upsertObject(event.object)
    }

    // ─── 3. Object Updated ─────────────────────────────────────────────────────
    const handleObjectUpdatedAck = (event: ObjectUpdatedAck) => {
      upsertObject(event.object)
      commitPendingOp(event.clientOpId)
    }

    const handleObjectUpdated = (event: ObjectUpdatedEvent) => {
      upsertObject(event.object)
    }

    // ─── 4. Object Deleted ─────────────────────────────────────────────────────
    const handleObjectDeletedAck = (event: ObjectDeletedAck) => {
      commitPendingOp(event.clientOpId)
    }

    const handleObjectDeleted = (event: ObjectDeletedEvent) => {
      removeObject(event.objectId)
    }

    // ─── 5. Undo / Redo ───────────────────────────────────────────────────────
    const handleUndoRedo = (event: UndoRedoEvent) => {
      applyUndoRedo(event)
    }

    // ─── 6. Presence ──────────────────────────────────────────────────────────
    const handlePresence = (event: PresenceUpdateEvent) => {
      updatePresence(event)
    }

    // ─── 7. Object Editing Awareness ──────────────────────────────────────────
    const handleObjectEditing = (event: ObjectEditingEvent) => {
      if (event.status === "STARTED") {
        setEditingState(event.objectId, {
          user: event.user,
          timestamp: event.timestamp,
        })
      } else {
        setEditingState(event.objectId, null)
      }
    }

    // ─── 8. Socket Errors & Conflicts ─────────────────────────────────────────
    const handleWsError = (err: WsErrorPayload & { clientOpId?: string }) => {
      if (err.clientOpId) {
        rollbackPendingOp(err.clientOpId)
      }

      if (err.code === "PERMISSION_DENIED") {
        toast.error(err.message || "Permission Denied. You do not have access to this board.")
        window.location.replace("/dashboard")
        return
      }

      if (err.code === "OBJECT_LOCKED" && err.meta?.objectId) {
        toast.error(err.message || "This object is locked by another user.")
        const customEvent = new CustomEvent(`object-lock-failed-${err.meta.objectId}`)
        window.dispatchEvent(customEvent)
        return
      }

      if (
        err.code === "OBJECT_VERSION_CONFLICT" ||
        err.code === "VERSION_CONFLICT"
      ) {
        toast.error("Edit conflict detected. whiteBoard state updated.")
        // Sync to fetch latest server revision
        socket.emit(ClientEvents.BOARD_SYNC, {
          boardId,
          lastSeenRevision: revision,
        })
      } else {
        toast.error(err.message || "An error occurred on the server.")
      }
    }

    // Subscribe to server events
    const onObjectCreated = (event: ObjectCreatedAck | ObjectCreatedEvent) => {
      if ("clientOpId" in event) {
        handleObjectCreatedAck(event)
      } else {
        handleObjectCreated(event)
      }
    }

    const onObjectUpdated = (event: ObjectUpdatedAck | ObjectUpdatedEvent) => {
      if ("clientOpId" in event) {
        handleObjectUpdatedAck(event)
      } else {
        handleObjectUpdated(event)
      }
    }

    const onObjectDeleted = (event: ObjectDeletedAck | ObjectDeletedEvent) => {
      if ("clientOpId" in event) {
        handleObjectDeletedAck(event)
      } else {
        handleObjectDeleted(event)
      }
    }

    const handleObjectMoveEphemeral = (event: ObjectMoveEphemeralEvent) => {
      const { objectId, ...coords } = event
      updateObjectFields(objectId, coords)
    }

    socket.on(ServerEvents.BOARD_STATE, handleBoardState)
    socket.on(ServerEvents.OBJECT_CREATED, onObjectCreated)
    socket.on(ServerEvents.OBJECT_UPDATED, onObjectUpdated)
    socket.on(ServerEvents.OBJECT_DELETED, onObjectDeleted)
    socket.on(ServerEvents.UNDO_REDO, handleUndoRedo)
    socket.on(ServerEvents.PRESENCE_UPDATE, handlePresence)
    socket.on(ServerEvents.OBJECT_EDITING, handleObjectEditing)
    socket.on(ServerEvents.OBJECT_MOVE_EPHEMERAL, handleObjectMoveEphemeral)
    socket.on(ServerEvents.ERROR, handleWsError)

    return () => {
      socket.off(ServerEvents.BOARD_STATE, handleBoardState)
      socket.off(ServerEvents.OBJECT_CREATED, onObjectCreated)
      socket.off(ServerEvents.OBJECT_UPDATED, onObjectUpdated)
      socket.off(ServerEvents.OBJECT_DELETED, onObjectDeleted)
      socket.off(ServerEvents.UNDO_REDO, handleUndoRedo)
      socket.off(ServerEvents.PRESENCE_UPDATE, handlePresence)
      socket.off(ServerEvents.OBJECT_EDITING, handleObjectEditing)
      socket.off(ServerEvents.OBJECT_MOVE_EPHEMERAL, handleObjectMoveEphemeral)
      socket.off(ServerEvents.ERROR, handleWsError)
    }
  }, [
    boardId,
    revision,
    initBoard,
    upsertObject,
    removeObject,
    applyUndoRedo,
    updatePresence,
    setEditingState,
    commitPendingOp,
    rollbackPendingOp,
    updateObjectFields,
  ])
}
