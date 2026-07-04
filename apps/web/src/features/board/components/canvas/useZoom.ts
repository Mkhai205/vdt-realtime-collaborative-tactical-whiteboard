import { useCallback } from "react"
import type Konva from "konva"
import { useUIStore, VIEWPORT_MIN_SCALE, VIEWPORT_MAX_SCALE } from "@/stores/ui.store"

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Factor applied on each scroll-wheel click */
const ZOOM_FACTOR = 0.1

// ─── Hook ───────────────────────────────────────────────────────────────────────

export type UseZoomOptions = {
  stageRef: React.RefObject<Konva.Stage | null>
}

export type UseZoomReturn = {
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void
}

/**
 * Handles the wheel event on the Konva Stage:
 * - Ctrl / Cmd + scroll  → zoom in / out centred on pointer
 * - Plain scroll         → pan (shift the stage position)
 *
 * All limits are enforced via VIEWPORT_MIN_SCALE / VIEWPORT_MAX_SCALE.
 */
export function useZoom({ stageRef }: UseZoomOptions): UseZoomReturn {
  const setViewport = useUIStore((s) => s.setViewport)

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      const evt = e.evt
      evt.preventDefault()

      const stage = stageRef.current
      if (!stage) return

      if (useUIStore.getState().followingUserId) {
        useUIStore.getState().setFollowingUserId(null)
      }

      const { x: stageX, y: stageY, scale: oldScale } = useUIStore.getState().viewport

      // ── Ctrl / Cmd: zoom ───────────────────────────────────────────────
      if (evt.ctrlKey || evt.metaKey) {
        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const direction = evt.deltaY < 0 ? 1 : -1
        const factor = 1 + direction * ZOOM_FACTOR
        const newScale = Math.min(
          VIEWPORT_MAX_SCALE,
          Math.max(VIEWPORT_MIN_SCALE, oldScale * factor),
        )

        // Zoom to pointer: keep the world point under the cursor fixed
        const newX = pointer.x - (pointer.x - stageX) * (newScale / oldScale)
        const newY = pointer.y - (pointer.y - stageY) * (newScale / oldScale)

        setViewport({ x: newX, y: newY, scale: newScale })
        return
      }

      // ── Plain scroll: pan ──────────────────────────────────────────────
      // deltaX / deltaY may come from trackpad two-finger drag
      const dx = evt.deltaX
      const dy = evt.deltaY

      setViewport({
        x: stageX - dx,
        y: stageY - dy,
        scale: oldScale,
      })
    },
    [stageRef, setViewport],
  )

  return { handleWheel }
}
