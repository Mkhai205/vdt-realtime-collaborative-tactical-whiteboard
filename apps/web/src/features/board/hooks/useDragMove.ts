/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useMemo } from "react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { getSocket } from "@/lib/socket/socket"
import { ClientEvents } from "@rctw/shared-contracts"

// ─── Types ─────────────────────────────────────────────────────────────────────

type OriginalPositions = Map<string, { x: number; y: number }>

export type UseDragMoveReturn = {
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Drag-move handler for board objects.
 *
 * Supports multi-select: when the dragged object is part of a multi-selection,
 * the computed delta is applied to ALL selected objects so they move together.
 *
 * All mutations are optimistic (board store only); socket emit in Plan 08.
 *
 * Flow:
 *   onDragStart(id)
 *     → Record world positions of all selected objects as rollback baseline
 *
 *   onDragEnd(id, newX, newY)
 *     → If single: just update that object
 *     → If multi: compute delta from dragged node, apply to all
 *
 * Note: Konva fires onDragEnd after the node is already moved, so newX/newY
 * are the node's final position in world space.
 */
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

export function useDragMove(
  updateObject: (objectId: string, patch: { x: number; y: number }) => void,
  setObjectEditingState?: (objectId: string, status: "STARTED" | "ENDED") => void,
): UseDragMoveReturn {
  const originalPositionsRef = useRef<OriginalPositions>(new Map())
  const boardId = useBoardStore((s) => s.boardId)

  const throttledEmit = useMemo(
    () =>
      throttle((objectId: string, coords: { x?: number; y?: number }) => {
        const socket = getSocket()
        if (socket.connected && boardId) {
          socket.emit(ClientEvents.OBJECT_MOVE_EPHEMERAL, {
            boardId,
            objectId,
            ...coords,
          })
        }
      }, 50),
    [boardId],
  )

  const onDragStart = useCallback((id: string) => {
    const { objects } = useBoardStore.getState()
    const { selectedIds } = useUIStore.getState()

    const originals: OriginalPositions = new Map()

    // Always record the dragged object
    const dragged = objects.get(id)
    if (dragged) {
      originals.set(id, { x: dragged.x, y: dragged.y })
      if (setObjectEditingState) {
        setObjectEditingState(id, "STARTED")
      }
    }

    // Record all other selected objects too
    if (selectedIds.has(id)) {
      for (const selId of selectedIds) {
        if (selId === id) continue
        const obj = objects.get(selId)
        if (obj) {
          originals.set(selId, { x: obj.x, y: obj.y })
          if (setObjectEditingState) {
            setObjectEditingState(selId, "STARTED")
          }
        }
      }
    }

    originalPositionsRef.current = originals
  }, [setObjectEditingState])

  const onDragMove = useCallback(
    (id: string, newX: number, newY: number, e: any) => {
      const { objects } = useBoardStore.getState()
      const { selectedIds } = useUIStore.getState()
      const originals = originalPositionsRef.current

      const obj = objects.get(id)
      if (!obj) return

      const isMultiSelect = selectedIds.has(id) && selectedIds.size > 1

      if (isMultiSelect) {
        // Compute delta from original position of the dragged object
        const orig = originals.get(id)
        if (!orig) {
          throttledEmit(id, { x: newX, y: newY })
          return
        }

        const dx = newX - orig.x
        const dy = newY - orig.y

        // 1. Update other selected shapes imperatively for smooth local dragging
        const stage = e.target?.getStage()
        if (stage) {
          for (const selId of selectedIds) {
            if (selId === id) continue
            const node = stage.findOne(`#${selId}`)
            if (node) {
              const selOrig = originals.get(selId)
              if (selOrig) {
                node.position({
                  x: selOrig.x + dx,
                  y: selOrig.y + dy,
                })
              }
            }
          }
          stage.batchDraw()
        }

        // 2. Broadcast updates for all moving objects
        for (const selId of selectedIds) {
          const selObj = objects.get(selId)
          if (!selObj) continue

          if (selId === id) {
            throttledEmit(selId, { x: newX, y: newY })
          } else {
            const selOrig = originals.get(selId)
            if (selOrig) {
              throttledEmit(selId, { x: selOrig.x + dx, y: selOrig.y + dy })
            }
          }
        }
      } else {
        // Single object drag
        throttledEmit(id, { x: newX, y: newY })
      }
    },
    [throttledEmit],
  )

  const onDragEnd = useCallback(
    (id: string, newX: number, newY: number) => {
      const { objects } = useBoardStore.getState()
      const { selectedIds } = useUIStore.getState()
      const originals = originalPositionsRef.current

      const obj = objects.get(id)
      if (!obj) return

      const isMultiSelect = selectedIds.has(id) && selectedIds.size > 1

      if (isMultiSelect) {
        // Compute delta from original position of the dragged object
        const orig = originals.get(id)
        if (!orig) {
          // Fallback — just update the single object
          updateObject(id, { x: newX, y: newY })
          if (setObjectEditingState) {
            setObjectEditingState(id, "ENDED")
          }
          return
        }

        const dx = newX - orig.x
        const dy = newY - orig.y

        // Apply delta to all selected objects
        for (const selId of selectedIds) {
          const selObj = objects.get(selId)
          if (!selObj) continue

          if (selId === id) {
            updateObject(selId, { x: newX, y: newY })
          } else {
            const selOrig = originals.get(selId)
            if (selOrig) {
              updateObject(selId, { x: selOrig.x + dx, y: selOrig.y + dy })
            }
          }

          if (setObjectEditingState) {
            setObjectEditingState(selId, "ENDED")
          }
        }
      } else {
        // Single object drag
        updateObject(id, { x: newX, y: newY })
        if (setObjectEditingState) {
          setObjectEditingState(id, "ENDED")
        }
      }

      originalPositionsRef.current = new Map()
    },
    [updateObject, setObjectEditingState],
  )

  return { onDragStart, onDragMove, onDragEnd }
}
