"use client"

import { useEffect, useRef, useState } from "react"
import { useUIStore } from "@/stores/ui.store"

/**
 * Briefly shows the current zoom percentage at the bottom-centre of the
 * screen whenever the zoom level changes, then fades out after 1.5 s.
 * Matches Figma / Excalidraw UX.
 */
export function ZoomIndicator() {
  const scale = useUIStore((s) => s.viewport.scale)
  const pct = Math.round(scale * 100)

  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPctRef = useRef(pct)

  useEffect(() => {
    if (pct === prevPctRef.current) return
    prevPctRef.current = pct

    setVisible(true)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, 1500)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [pct])

  if (!visible) return null

  return (
    <div
      id="zoom-indicator"
      className="zoom-indicator"
      aria-live="polite"
      aria-atomic="true"
    >
      {pct}%
    </div>
  )
}
