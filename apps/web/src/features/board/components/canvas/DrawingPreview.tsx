/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { memo } from "react"
import { Layer, Rect, Ellipse, Arrow, Line, Circle } from "react-konva"
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
  const activeSnapPoint = (style as any).activeSnapPoint as
    | { x: number; y: number }
    | undefined

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

      {type === "DIAMOND" && width > 0 && height > 0 && (
        <Line
          points={[x + width / 2, y, x + width, y + height / 2, x + width / 2, y + height, x, y + height / 2]}
          closed
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}

      {type === "TRIANGLE" && width > 0 && height > 0 && (
        <Line
          points={[x + width / 2, y, x + width, y + height, x, y + height]}
          closed
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}

      {type === "POLYGON" && width > 0 && height > 0 && (
        <Line
          points={[
            x + width * 0.5, y,
            x + width, y + height * 0.25,
            x + width, y + height * 0.75,
            x + width * 0.5, y + height,
            x, y + height * 0.75,
            x, y + height * 0.25,
          ]}
          closed
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
          pointerAtBeginning={style.arrowStart}
          pointerAtEnding={style.arrowEnd}
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

      {activeSnapPoint && (
        <Circle
          x={activeSnapPoint.x}
          y={activeSnapPoint.y}
          radius={6}
          fill="#6366f1"
          stroke="#ffffff"
          strokeWidth={1.5}
          shadowColor="#6366f1"
          shadowBlur={6}
          shadowOpacity={0.6}
        />
      )}
    </Layer>
  )
})
