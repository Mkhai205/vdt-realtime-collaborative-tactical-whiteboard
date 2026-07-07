import { useRef, useCallback, useEffect } from "react"
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
  const setViewport = useUIStore((s) => s.setViewport)
  const patchViewport = useUIStore((s) => s.patchViewport)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────

  const panTo = useCallback(
    (x: number, y: number) => {
      patchViewport({ x, y })
    },
    [patchViewport],
  )

  /**
   * Smoothly animates the viewport coordinates and scale over 300ms using
   * requestAnimationFrame and easeInOutQuad.
   */
  const animateViewport = useCallback(
    (targetX: number, targetY: number, targetScale: number) => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }

      const { x: startX, y: startY, scale: startScale } = useUIStore.getState().viewport
      const duration = 300 // ms
      const startTime = performance.now()

      const step = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(1, elapsed / duration)

        // EaseInOutQuad
        const ease =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2

        const nextX = startX + (targetX - startX) * ease
        const nextY = startY + (targetY - startY) * ease
        const nextScale = startScale + (targetScale - startScale) * ease

        setViewport({ x: nextX, y: nextY, scale: nextScale })

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step)
        } else {
          animationRef.current = null
        }
      }

      animationRef.current = requestAnimationFrame(step)
    },
    [setViewport],
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
      const { x: stageX, y: stageY, scale: oldScale } = useUIStore.getState().viewport

      const newX = centerX - (centerX - stageX) * (clampedScale / oldScale)
      const newY = centerY - (centerY - stageY) * (clampedScale / oldScale)

      setViewport({ x: newX, y: newY, scale: clampedScale })
    },
    [setViewport],
  )

  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    const cx = stage ? stage.width() / 2 : window.innerWidth / 2
    const cy = stage ? stage.height() / 2 : window.innerHeight / 2
    const scale = useUIStore.getState().viewport.scale
    zoomTo(scale * 1.1, cx, cy)
  }, [zoomTo])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    const cx = stage ? stage.width() / 2 : window.innerWidth / 2
    const cy = stage ? stage.height() / 2 : window.innerHeight / 2
    const scale = useUIStore.getState().viewport.scale
    zoomTo(scale / 1.1, cx, cy)
  }, [zoomTo])

  const resetZoom = useCallback(() => {
    const stage = stageRef.current
    const cx = stage ? stage.width() / 2 : window.innerWidth / 2
    const cy = stage ? stage.height() / 2 : window.innerHeight / 2
    animateViewport(cx - cx / 1, cy - cy / 1, 1)
  }, [animateViewport])

  const fitToObjects = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return

    const objectsLayer = stage.findOne("#objects-layer") as Konva.Layer | undefined
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

    animateViewport(newX, newY, clampedScale)
  }, [resetZoom, animateViewport])

  // ── Coordinate conversion ──────────────────────────────────────────────────

  /**
   * Convert world-space coordinates to screen-pixel coordinates.
   * screenX = worldX * scale + stageX
   */
  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      const { scale, x, y } = useUIStore.getState().viewport
      return {
        x: worldX * scale + x,
        y: worldY * scale + y,
      }
    },
    [],
  )

  /**
   * Convert screen-pixel coordinates to world-space coordinates.
   * worldX = (screenX - stageX) / scale
   */
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const { scale, x, y } = useUIStore.getState().viewport
      return {
        x: (screenX - x) / scale,
        y: (screenY - y) / scale,
      }
    },
    [],
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
