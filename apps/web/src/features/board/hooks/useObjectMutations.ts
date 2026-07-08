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

export const discardedLocalOps = new Set<string>()
export const pendingLocalUpdates = new Map<string, ObjectUpdatePatch>()

export function useObjectMutations(boardId: string) {
  const objects = useBoardStore((s) => s.objects)
  const upsertObject = useBoardStore((s) => s.upsertObject)
  const removeObject = useBoardStore((s) => s.removeObject)
  const removeObjects = useBoardStore((s) => s.removeObjects)
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

      return tempId
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

      if (objectId.startsWith("local-")) {
        const existingPatch = pendingLocalUpdates.get(objectId) || {}
        pendingLocalUpdates.set(objectId, { ...existingPatch, ...patch })
        return
      }

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

      if (objectId.startsWith("local-")) {
        const tempClientOpId = objectId.replace("local-", "")
        discardedLocalOps.add(tempClientOpId)
        pendingLocalUpdates.delete(objectId)
        return
      }

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

  const deleteObjectBatch = useCallback(
    (objectIds: string[]) => {
      if (objectIds.length === 0) return
      const socket = getSocket()
      const clientOpId = crypto.randomUUID()

      const items: { objectId: string; baseVersion: number }[] = []
      const localToDiscard: string[] = []

      for (const objectId of objectIds) {
        const current = objects.get(objectId)
        if (!current) continue

        if (objectId.startsWith("local-")) {
          // Local-only object: mark as discarded, no server call needed
          localToDiscard.push(objectId)
          pendingLocalUpdates.delete(objectId)
          discardedLocalOps.add(objectId.replace("local-", ""))
          continue
        }

        // Save original state for per-object rollback
        addPendingOp(`${clientOpId}:${objectId}`, current)
        items.push({ objectId, baseVersion: current.version })
      }

      // Optimistic: remove all in 1 single state update (1 re-render)
      removeObjects([...objectIds.filter((id) => objects.has(id))])

      if (items.length === 0) return

      socket.emit(ClientEvents.OBJECT_DELETE_BATCH, {
        clientOpId,
        boardId,
        items,
      })
    },
    [boardId, objects, removeObjects, addPendingOp],
  )

  const undo = useCallback(() => {
    const socket = getSocket()
    socket.emit(ClientEvents.OPERATION_UNDO, { boardId })
  }, [boardId])

  const redo = useCallback(() => {
    const socket = getSocket()
    socket.emit(ClientEvents.OPERATION_REDO, { boardId })
  }, [boardId])

  const setObjectEditingState = useCallback(
    (objectId: string, status: "STARTED" | "ENDED") => {
      const socket = getSocket()
      if (socket.connected) {
        socket.emit(ClientEvents.OBJECT_EDITING, {
          boardId,
          objectId,
          status,
        })
      }
    },
    [boardId],
  )

  return {
    createObject,
    updateObject,
    deleteObject,
    deleteObjectBatch,
    undo,
    redo,
    setObjectEditingState,
  }
}

export type UseObjectMutationsReturn = ReturnType<typeof useObjectMutations>
