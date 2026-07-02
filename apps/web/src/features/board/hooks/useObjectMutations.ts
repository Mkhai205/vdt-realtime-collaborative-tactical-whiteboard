"use client"

import { useCallback } from "react"
import { useBoardStore } from "@/stores/board.store"
import { getSocket } from "@/lib/socket/socket"
import { ClientEvents } from "@rctw/shared-contracts"
import type {
  ObjectCreatePayload,
  ObjectUpdatePatch,
  BoardObjectDto,
} from "@rctw/shared-contracts"
import { useUIStore } from "@/stores/ui.store"

export function useObjectMutations(boardId: string) {
  const objects = useBoardStore((s) => s.objects)
  const upsertObject = useBoardStore((s) => s.upsertObject)
  const removeObject = useBoardStore((s) => s.removeObject)
  const addPendingOp = useBoardStore((s) => s.addPendingOp)

  const createObject = useCallback(
    (
      payload: ObjectCreatePayload,
      selectMode: "replace" | "add" | "none" = "replace",
    ) => {
      const socket = getSocket()
      const clientOpId = crypto.randomUUID()
      const tempId = `local-${clientOpId}`
      const now = new Date().toISOString()

      // Optimistic temp object creation
      const tempObj: BoardObjectDto = {
        id: tempId,
        boardId,
        type: payload.type,
        x: payload.x,
        y: payload.y,
        width: payload.width ?? null,
        height: payload.height ?? null,
        points: payload.points ?? null,
        text: payload.text ?? null,
        rotation: payload.rotation ?? 0,
        style: payload.style,
        zIndex: payload.zIndex ?? objects.size,
        version: 1, // Start with version 1
        createdById: "",
        updatedById: null,
        createdAt: now,
        updatedAt: now,
      }

      upsertObject(tempObj)
      addPendingOp(clientOpId, null) // null since it didn't exist before

      if (selectMode === "replace") {
        useUIStore.getState().setSelectedIds(new Set([tempId]))
      } else if (selectMode === "add") {
        useUIStore.getState().addToSelection(tempId)
      }

      socket.emit(ClientEvents.OBJECT_CREATE, {
        clientOpId,
        boardId,
        object: payload,
      })
    },
    [boardId, objects.size, upsertObject, addPendingOp],
  )

  const updateObject = useCallback(
    (objectId: string, patch: ObjectUpdatePatch) => {
      const socket = getSocket()
      const clientOpId = crypto.randomUUID()
      const current = objects.get(objectId)
      if (!current) return

      // Optimistic update
      const updatedObj = {
        ...current,
        ...patch,
        // Ensure standard width/height conversions
        width: patch.width !== undefined ? patch.width : current.width,
        height: patch.height !== undefined ? patch.height : current.height,
      } as BoardObjectDto

      upsertObject(updatedObj)
      addPendingOp(clientOpId, current) // save original for rollback

      socket.emit(ClientEvents.OBJECT_UPDATE, {
        clientOpId,
        boardId,
        objectId,
        baseVersion: current.version,
        patch,
      })
    },
    [boardId, objects, upsertObject, addPendingOp],
  )

  const deleteObject = useCallback(
    (objectId: string) => {
      const socket = getSocket()
      const clientOpId = crypto.randomUUID()
      const current = objects.get(objectId)
      if (!current) return

      // Optimistic deletion
      removeObject(objectId)
      addPendingOp(clientOpId, current)

      socket.emit(ClientEvents.OBJECT_DELETE, {
        clientOpId,
        boardId,
        objectId,
        baseVersion: current.version,
      })
    },
    [boardId, objects, removeObject, addPendingOp],
  )

  const undo = useCallback(() => {
    const socket = getSocket()
    socket.emit(ClientEvents.OPERATION_UNDO, { boardId })
  }, [boardId])

  const redo = useCallback(() => {
    const socket = getSocket()
    socket.emit(ClientEvents.OPERATION_REDO, { boardId })
  }, [boardId])

  return { createObject, updateObject, deleteObject, undo, redo }
}

export type UseObjectMutationsReturn = ReturnType<typeof useObjectMutations>
