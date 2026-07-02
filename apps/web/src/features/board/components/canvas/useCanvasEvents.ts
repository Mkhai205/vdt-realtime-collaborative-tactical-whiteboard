import { useCallback, useEffect, useRef } from "react"
import type Konva from "konva"
import { useUIStore } from "@/stores/ui.store"
import type { UsePanReturn } from "./usePan"
import type { UseZoomReturn } from "./useZoom"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UseCanvasEventsOptions = {
  stageRef: React.RefObject<Konva.Stage | null>
  pan: UsePanReturn
  zoom: UseZoomReturn
}

export type UseCanvasEventsReturn = {
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void
  onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
}

/**
 * Central event router for the Konva Stage.
 *
 * Priority order on mouse events:
 *   1. Pan (HAND tool or spacebar)
 *   2. Active tool handler (SELECT, DRAW_RECT, …)
 *
 * On dblClick on empty canvas → future: create text object (Plan 05+).
 */
export function useCanvasEvents({
  stageRef,
  pan,
  zoom,
}: UseCanvasEventsOptions): UseCanvasEventsReturn {
  const { activeTool } = useUIStore()
  const activeToolRef = useRef(activeTool)
  useEffect(() => {
    activeToolRef.current = activeTool
  })

  // RAF ref for mouse-move throttle
  const rafRef = useRef<number | null>(null)

  // ── Mouse down ─────────────────────────────────────────────────────────────

  const onMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Pan takes priority over tool-specific handlers
      pan.handlePanStart(e)
    },
    [pan],
  )

  // ── Mouse move (RAF-throttled) ─────────────────────────────────────────────

  const onMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        pan.handlePanMove(e)
        // Plan 05+: forward to active drawing tool when not panning
      })
    },
    [pan],
  )

  // ── Mouse up ───────────────────────────────────────────────────────────────

  const onMouseUp = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      pan.handlePanEnd()
      // Plan 05+: finalize active drawing tool shape
    },
    [pan],
  )

  // ── Wheel ──────────────────────────────────────────────────────────────────

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      zoom.handleWheel(e)
    },
    [zoom],
  )

  // ── Double-click ───────────────────────────────────────────────────────────

  const onDblClick = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      // Placeholder: Plan 05+ will wire tool-specific dblClick logic here
      // e.g. SELECT tool dblClick on text object → enter edit mode
      //      Empty canvas dblClick → create text
      void stageRef
    },
    [stageRef],
  )

  return { onMouseDown, onMouseMove, onMouseUp, onWheel, onDblClick }
}
