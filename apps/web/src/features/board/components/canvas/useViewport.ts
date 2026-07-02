import { useRef, useCallback } from "react"
import type Konva from "konva"
import {
  useUIStore,
  VIEWPORT_MIN_SCALE,
  VIEWPORT_MAX_SCALE,
} from "@/stores/ui.store"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UseViewportReturn = {
  stageRef: React.RefObject<Konva.Stage | null>

  // Navigation
  panTo: (x: number, y: number) => void
  zoomTo: (scale: number, centerX: number, centerY: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitToObjects: () => void

  // Coordinate conversion
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number }
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number }
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Provides viewport state helpers and coordinate conversion utilities.
 * Syncs with UIStore so the rest of the app can read viewport values.
 */
export function useViewport(): UseViewportReturn {
  const stageRef = useRef<Konva.Stage | null>(null)
  const { viewport, setViewport, patchViewport } = useUIStore()

  // ── Navigation ────────────────────────────────────────────────────────────

  const panTo = useCallback(
    (x: number, y: number) => {
      patchViewport({ x, y })
    },
    [patchViewport],
  )

  /**
   * Zoom the stage to `scale` keeping the point (centerX, centerY) in screen
   * space visually fixed — identical to Figma / Excalidraw zoom-to-pointer.
   */
  const zoomTo = useCallback(
    (scale: number, centerX: number, centerY: number) => {
      const clampedScale = Math.min(
        VIEWPORT_MAX_SCALE,
        Math.max(VIEWPORT_MIN_SCALE, scale),
      )
      const { x: stageX, y: stageY, scale: oldScale } = viewport

      const newX = centerX - (centerX - stageX) * (clampedScale / oldScale)
      const newY = centerY - (centerY - stageY) * (clampedScale / oldScale)

      setViewport({ x: newX, y: newY, scale: clampedScale })
    },
    [viewport, setViewport],
  )

  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    const cx = stage ? stage.width() / 2 : window.innerWidth / 2
    const cy = stage ? stage.height() / 2 : window.innerHeight / 2
    zoomTo(viewport.scale * 1.1, cx, cy)
  }, [viewport.scale, zoomTo])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    const cx = stage ? stage.width() / 2 : window.innerWidth / 2
    const cy = stage ? stage.height() / 2 : window.innerHeight / 2
    zoomTo(viewport.scale / 1.1, cx, cy)
  }, [viewport.scale, zoomTo])

  const resetZoom = useCallback(() => {
    const stage = stageRef.current
    const cx = stage ? stage.width() / 2 : window.innerWidth / 2
    const cy = stage ? stage.height() / 2 : window.innerHeight / 2
    setViewport({ x: cx - cx / 1, y: cy - cy / 1, scale: 1 })
  }, [setViewport])

  const fitToObjects = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return

    // Objects layer is index 1 per the layer structure doc
    const objectsLayer = stage.getLayers()[1]
    if (!objectsLayer) return

    const children = objectsLayer.getChildren()
    if (children.length === 0) {
      resetZoom()
      return
    }

    // Compute bounding rect in world space
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const child of children) {
      const rect = child.getClientRect({ relativeTo: objectsLayer })
      minX = Math.min(minX, rect.x)
      minY = Math.min(minY, rect.y)
      maxX = Math.max(maxX, rect.x + rect.width)
      maxY = Math.max(maxY, rect.y + rect.height)
    }

    const PADDING = 80
    const contentW = maxX - minX + PADDING * 2
    const contentH = maxY - minY + PADDING * 2
    const scale = Math.min(
      stage.width() / contentW,
      stage.height() / contentH,
      VIEWPORT_MAX_SCALE,
    )
    const clampedScale = Math.max(VIEWPORT_MIN_SCALE, scale)

    const newX = (stage.width() - contentW * clampedScale) / 2 - (minX - PADDING) * clampedScale
    const newY = (stage.height() - contentH * clampedScale) / 2 - (minY - PADDING) * clampedScale

    setViewport({ x: newX, y: newY, scale: clampedScale })
  }, [resetZoom, setViewport])

  // ── Coordinate conversion ──────────────────────────────────────────────────

  /**
   * Convert world-space coordinates to screen-pixel coordinates.
   * screenX = worldX * scale + stageX
   */
  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => ({
      x: worldX * viewport.scale + viewport.x,
      y: worldY * viewport.scale + viewport.y,
    }),
    [viewport],
  )

  /**
   * Convert screen-pixel coordinates to world-space coordinates.
   * worldX = (screenX - stageX) / scale
   */
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - viewport.x) / viewport.scale,
      y: (screenY - viewport.y) / viewport.scale,
    }),
    [viewport],
  )

  return {
    stageRef,
    panTo,
    zoomTo,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToObjects,
    worldToScreen,
    screenToWorld,
  }
}
