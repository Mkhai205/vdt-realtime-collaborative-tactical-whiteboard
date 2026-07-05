/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from "react"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { getSocket } from "@/lib/socket/socket"
import { ClientEvents } from "@rctw/shared-contracts"
import { safePoints } from "../components/canvas/objects/shapeDefaults"

// ─── Throttle Helper ────────────────────────────────────────────────────────────

function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
): T {
  let inThrottle = false
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  } as any
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Handles Konva Transformer `transformstart`, `transform`, and `transformend` events.
 *
 * When Konva scales a node via resize handles it modifies `scaleX/scaleY`
 * rather than `width/height`. This hook converts scale back into real
 * dimensions and persists to the board store.
 *
 * Ephemeral updates are broadcast to other clients in real-time during transforming.
 */
export function useTransform(
  updateObject: (
    objectId: string,
    patch: {
      x?: number
      y?: number
      width?: number | null
      height?: number | null
      rotation?: number
    },
  ) => void,
  setObjectEditingState?: (objectId: string, status: "STARTED" | "ENDED") => void,
) {
  const boardId = useBoardStore((s) => s.boardId)

  const throttledEmit = useMemo(
    () =>
      throttle(
        (
          objectId: string,
          coords: {
            x?: number
            y?: number
            width?: number
            height?: number
            rotation?: number
          },
        ) => {
          const socket = getSocket()
          if (socket.connected && boardId) {
            socket.emit(ClientEvents.OBJECT_MOVE_EPHEMERAL, {
              boardId,
              objectId,
              ...coords,
            })
          }
        },
        50,
      ),
    [boardId],
  )

  const onTransformStart = useCallback(
    () => {
      const { selectedIds } = useUIStore.getState()
      if (setObjectEditingState) {
        for (const id of selectedIds) {
          setObjectEditingState(id, "STARTED")
        }
      }
    },
    [setObjectEditingState],
  )

  const onTransform = useCallback(
    (e: KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node
      const id = node.id()
      const objects = useBoardStore.getState().objects
      const obj = objects.get(id)
      if (!obj) return

      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      const rotation = node.rotation()
      const nodeX = node.x()
      const nodeY = node.y()

      let newX = nodeX
      let newY = nodeY
      let newWidth: number | undefined
      let newHeight: number | undefined

      if (obj.type === "CIRCLE") {
        const originalW = obj.width ?? 100
        const originalH = obj.height ?? 100
        newWidth = originalW * scaleX
        newHeight = originalH * scaleY
        const rx = newWidth / 2
        const ry = newHeight / 2
        newX = nodeX - rx
        newY = nodeY - ry
      } else if (obj.type === "LINE" || obj.type === "PATH") {
        const pts = safePoints(obj.points)
        if (pts.length >= 4) {
          const xCoords = pts.filter((_, idx) => idx % 2 === 0)
          const yCoords = pts.filter((_, idx) => idx % 2 === 1)
          const minX = Math.min(...xCoords)
          const minY = Math.min(...yCoords)
          const originalW = Math.max(...xCoords) - minX
          const originalH = Math.max(...yCoords) - minY
          newWidth = originalW * scaleX
          newHeight = originalH * scaleY
        } else {
          newWidth = obj.width ?? undefined
          newHeight = obj.height ?? undefined
        }
      } else {
        newWidth = (obj.width ?? 100) * scaleX
        newHeight = (obj.height ?? 80) * scaleY
      }

      throttledEmit(id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        rotation,
      })
    },
    [throttledEmit],
  )

  const onTransformEnd = useCallback(
    (e: KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node
      const id = node.id()
      const objects = useBoardStore.getState().objects
      const obj = objects.get(id)
      if (!obj) return

      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)

      const rotation = node.rotation()
      const nodeX = node.x()
      const nodeY = node.y()

      let newX = nodeX
      let newY = nodeY
      let newWidth: number | undefined
      let newHeight: number | undefined

      if (obj.type === "CIRCLE") {
        const originalW = obj.width ?? 100
        const originalH = obj.height ?? 100
        newWidth = originalW * scaleX
        newHeight = originalH * scaleY
        const rx = newWidth / 2
        const ry = newHeight / 2
        newX = nodeX - rx
        newY = nodeY - ry
      } else if (obj.type === "LINE" || obj.type === "PATH") {
        const pts = safePoints(obj.points)
        if (pts.length >= 4) {
          const xCoords = pts.filter((_, idx) => idx % 2 === 0)
          const yCoords = pts.filter((_, idx) => idx % 2 === 1)
          const minX = Math.min(...xCoords)
          const minY = Math.min(...yCoords)
          const originalW = Math.max(...xCoords) - minX
          const originalH = Math.max(...yCoords) - minY
          newWidth = originalW * scaleX
          newHeight = originalH * scaleY
        } else {
          newWidth = obj.width ?? undefined
          newHeight = obj.height ?? undefined
        }
      } else {
        newWidth = (obj.width ?? 100) * scaleX
        newHeight = (obj.height ?? 80) * scaleY
      }

      updateObject(id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        rotation,
      })

      const { selectedIds } = useUIStore.getState()
      if (setObjectEditingState) {
        for (const selId of selectedIds) {
          setObjectEditingState(selId, "ENDED")
        }
      }
    },
    [updateObject, setObjectEditingState],
  )

  return { onTransformStart, onTransform, onTransformEnd }
}

export type UseTransformReturn = ReturnType<typeof useTransform>
