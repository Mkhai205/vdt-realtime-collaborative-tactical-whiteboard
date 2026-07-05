"use client"

import { memo } from "react"
import { Layer, Rect, Ellipse, Arrow, Line } from "react-konva"
import { useUIStore } from "@/stores/ui.store"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * The UI layer (Layer 3) that renders the in-progress drawing preview.
 *
 * Reads from the Zustand `ui` store's `previewShape` to update in real-time
 * during drawing.
 *
 * Uses dashed strokes and reduced opacity to visually distinguish previews
 * from committed objects.
 */
export const DrawingPreview = memo(function DrawingPreview() {
  const preview = useUIStore((s) => s.previewShape)
  if (!preview) return <Layer id="ui-layer" listening={false} />

  const { type, x, y, width = 0, height = 0, points, style } = preview
  const stroke = style.stroke ?? "#6366f1"
  const fill = style.fill ?? "transparent"
  const strokeWidth = style.strokeWidth ?? 2
  const opacity = style.opacity ?? 1

  return (
    <Layer id="ui-layer" listening={false}>
      {type === "RECTANGLE" && width > 0 && height > 0 && (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          cornerRadius={4}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}

      {type === "CIRCLE" && width > 0 && height > 0 && (
        <Ellipse
          x={x + width / 2}
          y={y + height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}

      {type === "LINE" && points && points.length >= 4 && (
        <Arrow
          points={points}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill={stroke}
          opacity={opacity}
          pointerAtEnding
          pointerLength={10}
          pointerWidth={7}
          lineCap="round"
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}

      {type === "PATH" && points && points.length >= 4 && (
        <Line
          points={points}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          tension={0.3}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}
    </Layer>
  )
})
