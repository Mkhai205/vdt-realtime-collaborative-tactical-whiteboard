import { useRef, useCallback } from "react"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UseLassoSelectReturn = {
  /**
   * Callback ref for the lasso Rect node inside SelectionLayer.
   * Pass this directly as `ref={lassoSelect.setLassoRect}` — React 19 allows
   * callback refs during render; ref objects from useRef are not allowed.
   */
  setLassoRect: (node: Konva.Rect | null) => void
  onMouseDown: (e: KonvaEventObject<MouseEvent>) => void
  onMouseMove: (e: KonvaEventObject<MouseEvent>) => void
  onMouseUp: () => void
  isLassoingRef: React.RefObject<boolean>
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getWorldPos(stage: Konva.Stage): { x: number; y: number } | null {
  const pos = stage.getPointerPosition()
  if (!pos) return null
  const scale = stage.scaleX()
  return {
    x: (pos.x - stage.x()) / scale,
    y: (pos.y - stage.y()) / scale,
  }
}

/** Returns true when two axis-aligned bounding boxes intersect */
function rectsIntersect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay)
}

/** Normalise lasso start/end to a proper {x,y,width,height} rect */
function normRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Rubber-band (lasso) selection for the SELECT tool.
 *
 * Works by:
 *  1. On mousedown on empty stage → record lassoStart in world space
 *  2. On mousemove → update the Konva Rect drawn in SelectionLayer
 *  3. On mouseup → intersect normalised rect against all board objects,
 *     call setSelectedIds with matching IDs
 *
 * The lassoRectRef is a ref to a Konva.Rect inside SelectionLayer.
 * This hook updates that node directly (imperative) to avoid React re-renders
 * on every mousemove.
 */
export function useLassoSelect(
  stageRef: React.RefObject<Konva.Stage | null>,
): UseLassoSelectReturn {
  // Internal ref — never returned directly (React 19 forbids ref objects in render)
  const lassoNodeRef = useRef<Konva.Rect | null>(null)
  const isLassoingRef = useRef(false)
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null)

  /** Callback ref — safe to pass as `ref={...}` prop in React 19 */
  const setLassoRect = useCallback((node: Konva.Rect | null) => {
    lassoNodeRef.current = node
  }, [])

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      // Only start on bare stage background
      if (e.target !== stage) return
      if (e.evt.button !== 0) return

      const wp = getWorldPos(stage)
      if (!wp) return

      isLassoingRef.current = true
      lassoStartRef.current = wp

      const rect = lassoNodeRef.current
      if (rect) {
        rect.setAttrs({ x: wp.x, y: wp.y, width: 0, height: 0, visible: true })
        rect.getLayer()?.batchDraw()
      }
    },
    [stageRef],
  )

  const onMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!isLassoingRef.current) return
      const stage = stageRef.current
      if (!stage || !lassoStartRef.current) return

      const wp = getWorldPos(stage)
      if (!wp) return

      const { x: sx, y: sy } = lassoStartRef.current
      const { x, y, width, height } = normRect(sx, sy, wp.x, wp.y)

      const rect = lassoNodeRef.current
      if (rect) {
        rect.setAttrs({ x, y, width, height })
        rect.getLayer()?.batchDraw()
      }

      // Suppress unused-var lint; e is needed by the signature to match Konva event type
      void e
    },
    [stageRef],
  )

  const onMouseUp = useCallback(() => {
    if (!isLassoingRef.current) return
    isLassoingRef.current = false

    const rect = lassoNodeRef.current
    if (rect) {
      rect.setAttrs({ visible: false, width: 0, height: 0 })
      rect.getLayer()?.batchDraw()
    }

    const start = lassoStartRef.current
    lassoStartRef.current = null
    if (!start) return

    const stage = stageRef.current
    if (!stage) return

    const wp = getWorldPos(stage)
    if (!wp) return

    const selRect = normRect(start.x, start.y, wp.x, wp.y)

    // Skip micro-drags (< 4px) — treat as a regular click on stage (clear selection)
    if (selRect.width < 4 && selRect.height < 4) {
      useUIStore.getState().clearSelection()
      return
    }

    const objects = useBoardStore.getState().objects
    const matchingIds: string[] = []

    for (const obj of objects.values()) {
      const ox = obj.x
      const oy = obj.y
      const ow = obj.width ?? 80
      const oh = obj.height ?? 80

      if (
        rectsIntersect(
          selRect.x,
          selRect.y,
          selRect.width,
          selRect.height,
          ox,
          oy,
          ow,
          oh,
        )
      ) {
        matchingIds.push(obj.id)
      }
    }

    if (matchingIds.length > 0) {
      useUIStore.getState().setSelectedIds(new Set(matchingIds))
    }
  }, [stageRef])

  return { setLassoRect, onMouseDown, onMouseMove, onMouseUp, isLassoingRef }
}
