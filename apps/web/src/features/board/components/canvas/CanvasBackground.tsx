"use client"

import { useMemo } from "react"
import { Layer, Circle } from "react-konva"
import { useUIStore } from "@/stores/ui.store"
import { useTheme } from "next-themes"

// ─── Constants ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 20 // world-space grid spacing at scale = 1
const DOT_RADIUS = 1

// ─── Theme colours ─────────────────────────────────────────────────────────────

const COLORS = {
  light: { dot: "#d1d5db" }, // gray-300
  dark: { dot: "#374151" }, // gray-700
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CanvasBackgroundProps {
  /** Visible stage width in pixels */
  stageWidth: number
  /** Visible stage height in pixels */
  stageHeight: number
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Konva Layer that renders an Excalidraw-style dot grid.
 *
 * Only the dots visible in the current viewport are rendered for performance.
 * The layer is automatically re-rendered by react-konva when viewport changes.
 */
export function CanvasBackground({
  stageWidth,
  stageHeight,
}: CanvasBackgroundProps) {
  const viewport = useUIStore((s) => s.viewport)
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === "dark"
  const dotColor = isDark ? COLORS.dark.dot : COLORS.light.dot

  const { scale, x: stageX, y: stageY } = viewport

  // ── Compute which dots are visible ────────────────────────────────────────

  const dots = useMemo(() => {
    // Prevent rendering millions of dots and crashing the browser at low zoom scales
    if (scale < 0.22) return []

    // World-space bounding box of the visible viewport
    const startX = Math.floor(-stageX / scale / GRID_SIZE) * GRID_SIZE
    const startY = Math.floor(-stageY / scale / GRID_SIZE) * GRID_SIZE
    const endX = startX + stageWidth / scale + GRID_SIZE
    const endY = startY + stageHeight / scale + GRID_SIZE

    const result: Array<{ key: string; x: number; y: number }> = []

    for (let wx = startX; wx <= endX; wx += GRID_SIZE) {
      for (let wy = startY; wy <= endY; wy += GRID_SIZE) {
        result.push({ key: `${wx}:${wy}`, x: wx, y: wy })
      }
    }

    return result
  }, [stageX, stageY, scale, stageWidth, stageHeight])

  return (
    <Layer listening={false}>
      {dots.map(({ key, x, y }) => (
        <Circle
          key={key}
          x={x}
          y={y}
          radius={DOT_RADIUS / scale}
          fill={dotColor}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      ))}
    </Layer>
  )
}
