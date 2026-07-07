"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LaserPoint {
  worldX: number
  worldY: number
  timestamp: number
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const TRAIL_DURATION_MS = 1000
const MAX_POINTS_PER_STROKE = 150

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Manages concurrent decaying laser trails (strokes) for the local user.
 *
 * Points are stored as a 2D array (`LaserPoint[][]`) where each sub-array
 * represents a single click-and-drag path. This allows previous paths to
 * continue fading out cleanly when the user starts a new stroke.
 */
export function useLaserPointer() {
  const pointsRef = useRef<LaserPoint[][]>([])
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)
  const isRunningRef = useRef(false)

  // ── RAF loop ────────────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    const loop = () => {
      const now = Date.now()
      let changed = false
      let stillHasPoints = false

      pointsRef.current = pointsRef.current
        .map((stroke) => {
          const beforeLen = stroke.length
          const pruned = stroke.filter((p) => now - p.timestamp < TRAIL_DURATION_MS)
          if (pruned.length !== beforeLen) changed = true
          if (pruned.length > 0) stillHasPoints = true
          return pruned
        })
        .filter((stroke) => stroke.length > 0)

      if (changed || stillHasPoints) {
        setTick((t) => t + 1)
      }

      if (stillHasPoints) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        isRunningRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current)
      }
      isRunningRef.current = false
    }
  }, [])

  // ── Public API ─────────────────────────────────────────────────────────────

  const startNewStroke = useCallback(() => {
    pointsRef.current.push([])
    setTick((t) => t + 1)
  }, [])

  const addPoint = useCallback(
    (worldX: number, worldY: number) => {
      if (pointsRef.current.length === 0) {
        pointsRef.current.push([])
      }
      const currentStroke = pointsRef.current[pointsRef.current.length - 1]!
      currentStroke.push({ worldX, worldY, timestamp: Date.now() })

      // Cap stroke size to avoid memory overflow
      if (currentStroke.length > MAX_POINTS_PER_STROKE) {
        currentStroke.shift()
      }

      startLoop()
    },
    [startLoop],
  )

  const clearPoints = useCallback(() => {
    pointsRef.current = []
    setTick((t) => t + 1)
  }, [])

  return { pointsRef, tick, addPoint, startNewStroke, clearPoints }
}

export type UseLaserPointerReturn = ReturnType<typeof useLaserPointer>

