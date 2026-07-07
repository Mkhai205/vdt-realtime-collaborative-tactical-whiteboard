import { useCallback, useRef } from "react"
import type Konva from "konva"
import { useUIStore } from "@/stores/ui.store"
import type { UsePanReturn } from "./usePan"
import type { UseZoomReturn } from "./useZoom"
import type { UseShapeCreationReturn } from "@/features/board/hooks/useShapeCreation"
import type { UseLassoSelectReturn } from "@/features/board/hooks/useLassoSelect"
import type { UseCursorEmitReturn } from "@/features/board/hooks/useCursorEmit"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UseCanvasEventsOptions = {
  stageRef: React.RefObject<Konva.Stage | null>
  pan: UsePanReturn
  zoom: UseZoomReturn
  shapeCreation: UseShapeCreationReturn
  lassoSelect: UseLassoSelectReturn
  cursorEmit: UseCursorEmitReturn
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
const DRAW_TOOLS = new Set([
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "ARROW",
  "PATH",
  "HIGHLIGHTER",
  "ICON",
  "TEXT",
  "DIAMOND",
  "TRIANGLE",
  "POLYGON",
])

// Suppress unused-var; PAN_TOOLS will be used for future cursor-override checks
void PAN_TOOLS

/**
 * Central event router for the Konva Stage.
 *
 * Priority:
 *   1. Pan (HAND tool or spacebar pressed)
 *   2. Shape creation (RECTANGLE, CIRCLE, LINE, TEXT, PATH, ICON)
 *   3. SELECT tool + empty stage drag → lasso select
 *   4. SELECT tool clicks → handled by individual ObjectRenderer click events
 */
export function useCanvasEvents({
  stageRef,
  pan,
  zoom,
  shapeCreation,
  lassoSelect,
  cursorEmit,
}: UseCanvasEventsOptions): UseCanvasEventsReturn {
  // RAF ref for mouse-move throttle
  const rafRef = useRef<number | null>(null)

  // ── Mouse down ─────────────────────────────────────────────────────────────

  const onMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const tool = useUIStore.getState().activeTool

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
        return
      }

      // SELECT tool + empty stage background → start lasso
      if (tool === "SELECT") {
        const stage = stageRef.current
        if (stage && e.target === stage) {
          lassoSelect.onMouseDown(e)
        }
      }
    },
    [pan, shapeCreation, lassoSelect, stageRef],
  )

  // ── Mouse move (RAF-throttled) ─────────────────────────────────────────────

  const onMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null

        const stage = stageRef.current
        if (stage) {
          cursorEmit.onCursorMove(stage)
        }

        if (pan.getIsPanning()) {
          pan.handlePanMove(e)
          return
        }

        const tool = useUIStore.getState().activeTool

        if (DRAW_TOOLS.has(tool)) {
          shapeCreation.onMouseMove(e)
          return
        }

        if (tool === "SELECT" && lassoSelect.isLassoingRef.current) {
          lassoSelect.onMouseMove(e)
        }
      })
    },
    [pan, shapeCreation, lassoSelect, cursorEmit, stageRef],
  )

  // ── Mouse up ───────────────────────────────────────────────────────────────

  const onMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (pan.getIsPanning()) {
        pan.handlePanEnd()
        return
      }

      const tool = useUIStore.getState().activeTool

      if (DRAW_TOOLS.has(tool)) {
        shapeCreation.onMouseUp(e)
        pan.handlePanEnd()
        return
      }

      if (tool === "SELECT") {
        lassoSelect.onMouseUp()
      }

      pan.handlePanEnd()
    },
    [pan, shapeCreation, lassoSelect],
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
    () => {
      // Plan 07+: SELECT + dblclick on text → inline edit (handled by TextObject internally)
      void stageRef
    },
    [stageRef],
  )

  return { onMouseDown, onMouseMove, onMouseUp, onWheel, onDblClick }
}
