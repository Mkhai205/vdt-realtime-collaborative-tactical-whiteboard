"use client"

import { useCallback } from "react"
import { Minus, Plus, Maximize2 } from "lucide-react"
import { useUIStore } from "@/stores/ui.store"
import type { UseViewportReturn } from "./useViewport"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ZoomControlsProps {
  viewport: UseViewportReturn
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Bottom-right zoom controls: [−] [75%] [+] [⊞ Fit]
 *
 * - Click on the percentage label → reset to 100 %
 * - [Fit] → fit all objects in view
 */
export function ZoomControls({ viewport }: ZoomControlsProps) {
  const { viewport: vp } = useUIStore()

  const pct = Math.round(vp.scale * 100)

  const handleResetZoom = useCallback(() => {
    viewport.resetZoom()
  }, [viewport])

  return (
    <div
      id="zoom-controls"
      className="zoom-controls"
      role="group"
      aria-label="Zoom controls"
    >
      {/* Zoom out */}
      <button
        id="zoom-out-btn"
        className="zoom-btn"
        onClick={viewport.zoomOut}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={14} />
      </button>

      {/* Percentage label — click to reset to 100 % */}
      <button
        id="zoom-reset-btn"
        className="zoom-pct"
        onClick={handleResetZoom}
        aria-label={`Current zoom: ${pct}%. Click to reset to 100%`}
        title="Reset to 100%"
      >
        {pct}%
      </button>

      {/* Zoom in */}
      <button
        id="zoom-in-btn"
        className="zoom-btn"
        onClick={viewport.zoomIn}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={14} />
      </button>

      {/* Separator */}
      <div className="zoom-sep" aria-hidden />

      {/* Fit all objects */}
      <button
        id="zoom-fit-btn"
        className="zoom-btn zoom-fit"
        onClick={viewport.fitToObjects}
        aria-label="Fit all objects in view"
        title="Fit to objects"
      >
        <Maximize2 size={14} />
        <span className="zoom-fit-label">Fit</span>
      </button>
    </div>
  )
}
