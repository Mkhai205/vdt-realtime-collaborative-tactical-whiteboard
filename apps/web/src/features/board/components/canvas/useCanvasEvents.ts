import { useCallback, useEffect, useRef } from "react"
import type Konva from "konva"
import { useUIStore } from "@/stores/ui.store"
import type { UsePanReturn } from "./usePan"
import type { UseZoomReturn } from "./useZoom"
import type { UseShapeCreationReturn } from "@/features/board/hooks/useShapeCreation"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UseCanvasEventsOptions = {
  stageRef: React.RefObject<Konva.Stage | null>
  pan: UsePanReturn
  zoom: UseZoomReturn
  shapeCreation: UseShapeCreationReturn
}

export type UseCanvasEventsReturn = {
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void
  onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
}

// ─── Tool routing constants ─────────────────────────────────────────────────────

const PAN_TOOLS = new Set(["SELECT", "HAND"])
const DRAW_TOOLS = new Set(["RECTANGLE", "CIRCLE", "LINE", "TEXT", "PATH", "ICON"])

/**
 * Central event router for the Konva Stage.
 *
 * Priority:
 *   1. Pan (HAND tool or spacebar pressed)
 *   2. Shape creation (RECTANGLE, CIRCLE, LINE, TEXT, PATH, ICON)
 *   3. SELECT tool → handled by individual ObjectRenderer click events
 */
export function useCanvasEvents({
  stageRef,
  pan,
  zoom,
  shapeCreation,
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
      const tool = activeToolRef.current

      // Pan takes absolute priority
      if (pan.getIsPanning() || tool === "HAND") {
        pan.handlePanStart(e)
        return
      }

      // Space-drag pan (checked via getIsPanning after handlePanStart returns)
      pan.handlePanStart(e)
      if (pan.getIsPanning()) return

      // Drawing tools
      if (DRAW_TOOLS.has(tool)) {
        shapeCreation.onMouseDown(e)
      }
    },
    [pan, shapeCreation],
  )

  // ── Mouse move (RAF-throttled) ─────────────────────────────────────────────

  const onMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null

        if (pan.getIsPanning()) {
          pan.handlePanMove(e)
          return
        }

        const tool = activeToolRef.current
        if (DRAW_TOOLS.has(tool)) {
          shapeCreation.onMouseMove(e)
        }
      })
    },
    [pan, shapeCreation],
  )

  // ── Mouse up ───────────────────────────────────────────────────────────────

  const onMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (pan.getIsPanning()) {
        pan.handlePanEnd()
        return
      }

      const tool = activeToolRef.current
      if (DRAW_TOOLS.has(tool)) {
        shapeCreation.onMouseUp(e)
      }

      pan.handlePanEnd()
    },
    [pan, shapeCreation],
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
      // Plan 07+: SELECT + dblclick on text → inline edit
      void stageRef
    },
    [stageRef],
  )

  return { onMouseDown, onMouseMove, onMouseUp, onWheel, onDblClick }
}
