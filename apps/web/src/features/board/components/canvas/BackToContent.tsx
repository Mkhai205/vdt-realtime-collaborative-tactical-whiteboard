"use client"

import { useEffect, useState, useMemo } from "react"
import { ArrowUp } from "lucide-react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import type { UseViewportReturn } from "./useViewport"

interface BackToContentProps {
  viewport: UseViewportReturn
}

export function BackToContent({ viewport }: BackToContentProps) {
  const objects = useBoardStore((s) => s.objects)
  const scale = useUIStore((s) => s.viewport.scale)
  const x = useUIStore((s) => s.viewport.x)
  const y = useUIStore((s) => s.viewport.y)

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  })

  // Listen to window resize to ensure correct screen coordinates calculation
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Calculate bounding box and out-of-view status
  const calcResult = useMemo(() => {
    if (objects.size === 0) {
      return { isOutOfView: false, angle: 0 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const obj of objects.values()) {
      let objMinX = obj.x
      let objMinY = obj.y
      let objMaxX = obj.x + (obj.width ?? 0)
      let objMaxY = obj.y + (obj.height ?? 0)

      const pts = obj.points as number[] | undefined
      if (pts && pts.length > 0) {
        for (let i = 0; i < pts.length; i += 2) {
          const pxOffset = pts[i]
          const pyOffset = pts[i + 1]
          if (pxOffset !== undefined && pyOffset !== undefined) {
            const px = obj.x + pxOffset
            const py = obj.y + pyOffset
            objMinX = Math.min(objMinX, px)
            objMinY = Math.min(objMinY, py)
            objMaxX = Math.max(objMaxX, px)
            objMaxY = Math.max(objMaxY, py)
          }
        }
      }

      minX = Math.min(minX, objMinX)
      minY = Math.min(minY, objMinY)
      maxX = Math.max(maxX, objMaxX)
      maxY = Math.max(maxY, objMaxY)
    }

    // Convert screen boundaries back to world space
    const screenLeftWorld = -x / scale
    const screenRightWorld = (windowSize.width - x) / scale
    const screenTopWorld = -y / scale
    const screenBottomWorld = (windowSize.height - y) / scale

    // Check if drawing bounding box overlaps with screen viewport
    const overlaps =
      maxX >= screenLeftWorld &&
      minX <= screenRightWorld &&
      maxY >= screenTopWorld &&
      minY <= screenBottomWorld

    if (overlaps) {
      return { isOutOfView: false, angle: 0 }
    }

    // Compute the direction angle pointing to the center of the content
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    const viewportCenterX = (-x + windowSize.width / 2) / scale
    const viewportCenterY = (-y + windowSize.height / 2) / scale

    const dx = contentCenterX - viewportCenterX
    const dy = contentCenterY - viewportCenterY

    // Angle in degrees (screen coordinates: positive Y is down)
    const angleRad = Math.atan2(dy, dx)
    const angleDeg = angleRad * (180 / Math.PI)

    return {
      isOutOfView: true,
      angle: angleDeg + 90, // Rotate ArrowUp (which points up) to point to target
    }
  }, [objects, x, y, scale, windowSize])

  if (!calcResult.isOutOfView) return null

  return (
    <button
      id="back-to-content-btn"
      className="back-to-content-btn"
      onClick={() => viewport.fitToObjects()}
      aria-label="Quay lại nội dung bản vẽ"
      title="Quay lại nội dung bản vẽ"
    >
      <ArrowUp
        className="back-to-content-arrow"
        style={{
          transform: `rotate(${calcResult.angle}deg)`,
        }}
      />
      <span>Quay lại nội dung</span>
    </button>
  )
}
