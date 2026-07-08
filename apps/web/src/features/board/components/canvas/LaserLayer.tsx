"use client"

import { memo } from "react"
import { Layer, Line, Circle } from "react-konva"
import type { MutableRefObject } from "react"
import type { LaserPoint } from "@/features/board/hooks/useLaserPointer"

// ─── Constants ──────────────────────────────────────────────────────────────────

const LASER_COLOR = "#ff2233"
const GLOW_COLOR = "rgba(255, 40, 50, 0.55)"

// ─── Props ──────────────────────────────────────────────────────────────────────

interface LaserLayerProps {
  /** Ref holding world-coordinate trail points (mutated externally) */
  pointsRef: MutableRefObject<LaserPoint[][]>
  /** Color override — used for remote users' lasers (avatarColor) */
  color?: string
  glowColor?: string
  /**
   * Incrementing counter from useLaserPointer that triggers a re-render
   * each RAF frame while the trail is active.
   */
  tick: number
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Ephemeral Konva Layer that renders the laser trail and cursor dot.
 *
 * Rendering strategy:
 *  - Renders the entire set of points as a single <Line> component with Bezier `tension`
 *  - This maximizes canvas performance (60 FPS) by avoiding shadowBlur Gaussian filters
 *    on 100+ separate segments.
 *  - Points are converted from world to screen coordinates.
 */
export const LaserLayer = memo(function LaserLayer({
  pointsRef,
  color = LASER_COLOR,
  glowColor = GLOW_COLOR,
  tick: _tick, // consumed only to trigger re-render
}: LaserLayerProps) {
  void _tick
  const pts = pointsRef.current
  if (pts.length === 0) return null

  const lastStroke = pts[pts.length - 1]!
  const lastPoint = lastStroke.length > 0 ? lastStroke[lastStroke.length - 1]! : null

  return (
    <Layer id="laser-layer" listening={false} perfectDrawEnabled={false}>
      {/* ── Render each active stroke as a smooth bezier curve ─────────── */}
      {pts.map((stroke, index) => {
        if (stroke.length < 2) return null

        const flatPoints: number[] = []
        stroke.forEach((p) => {
          flatPoints.push(p.worldX, p.worldY)
        })

        return (
          <Line
            key={index}
            points={flatPoints}
            stroke={color}
            strokeWidth={4.5}
            opacity={0.85}
            lineCap="round"
            lineJoin="round"
            tension={0.4}
            shadowColor={glowColor}
            shadowBlur={12}
            shadowOpacity={0.8}
            listening={false}
            perfectDrawEnabled={false}
          />
        )
      })}

      {/* ── Leading Cursor Dot (only at the tip of the current stroke) ─── */}
      {lastPoint && (
        <Circle
          x={lastPoint.worldX}
          y={lastPoint.worldY}
          radius={5}
          fill={color}
          shadowColor={color}
          shadowBlur={22}
          shadowOpacity={0.85}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Layer>
  )
})
