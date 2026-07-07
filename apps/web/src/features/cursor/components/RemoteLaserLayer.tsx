import { useEffect, useState } from "react"
import { Layer, Line, Circle, Group } from "react-konva"
import { useLaserStore } from "@/features/cursor/store/laser.store"
import type { RemoteLaserPoint } from "@/features/cursor/store/laser.store"
import type { Viewport } from "@/stores/ui.store"

// ─── Constants ──────────────────────────────────────────────────────────────────

const TRAIL_DURATION_MS = 1000

// ─── Props ──────────────────────────────────────────────────────────────────────

interface RemoteLaserLayerProps {
  viewport: Viewport
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Konva Layer that renders all active remote users' laser trails.
 *
 * Each user's trail uses their avatarColor so viewers can easily
 * distinguish who is pointing at what.
 *
 * Runs a requestAnimationFrame decay loop while there are active remote points
 * to ensure trails smoothly fade out.
 */
export function RemoteLaserLayer({ viewport }: RemoteLaserLayerProps) {
  const lasers = useLaserStore((s) => s.lasers)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const hasPoints = [...lasers.values()].some((l) =>
      [...l.strokes.values()].some((pts) => pts.length > 0)
    )
    if (!hasPoints) return

    let rafId: number
    const loop = () => {
      const now = Date.now()
      let stillActive = false

      lasers.forEach((laser) => {
        laser.strokes.forEach((pts, strokeId) => {
          const beforeLen = pts.length
          const pruned = pts.filter((p) => now - p.t < TRAIL_DURATION_MS)
          if (pruned.length !== beforeLen) {
            setTick((t) => t + 1)
          }
          if (pruned.length > 0) {
            stillActive = true
            laser.strokes.set(strokeId, pruned)
          } else {
            laser.strokes.delete(strokeId)
          }
        })
      })

      setTick((t) => t + 1)

      if (stillActive) {
        rafId = requestAnimationFrame(loop)
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [lasers])

  const toScreen = (wx: number, wy: number) => ({
    sx: wx * viewport.scale + viewport.x,
    sy: wy * viewport.scale + viewport.y,
  })

  return (
    <Layer id="remote-laser-layer" listening={false} perfectDrawEnabled={false}>
      {[...lasers.values()].map((laser) => {
        const color = laser.avatarColor
        const glow = `${color}88`

        // Find the last point across all active strokes to show the cursor dot
        let lastPoint: RemoteLaserPoint | null = null
        let maxTime = 0
        for (const pts of laser.strokes.values()) {
          if (pts.length > 0) {
            const p = pts[pts.length - 1]!
            if (p.t > maxTime) {
              maxTime = p.t
              lastPoint = p
            }
          }
        }

        const dotEl = lastPoint ? (() => {
          const { sx, sy } = toScreen(lastPoint.x, lastPoint.y)
          return (
            <Circle
              key={`${laser.userId}-dot`}
              x={sx}
              y={sy}
              radius={5}
              fill={color}
              shadowColor={color}
              shadowBlur={20}
              shadowOpacity={0.85}
              listening={false}
              perfectDrawEnabled={false}
            />
          )
        })() : null

        return (
          <Group key={laser.userId}>
            {[...laser.strokes.entries()].map(([strokeId, pts]) => {
              if (pts.length < 2) return null

              const flatPoints: number[] = []
              pts.forEach((p) => {
                const { sx, sy } = toScreen(p.x, p.y)
                flatPoints.push(sx, sy)
              })

              return (
                <Line
                  key={strokeId}
                  points={flatPoints}
                  stroke={color}
                  strokeWidth={4.5}
                  opacity={0.85}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.4}
                  shadowColor={glow}
                  shadowBlur={12}
                  shadowOpacity={0.8}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              )
            })}
            {dotEl}
          </Group>
        )
      })}
    </Layer>
  )
}
