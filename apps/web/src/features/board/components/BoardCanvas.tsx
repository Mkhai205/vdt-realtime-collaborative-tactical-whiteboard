"use client"

import { CanvasStage } from "./canvas/CanvasStage"
import { ZoomControls } from "./canvas/ZoomControls"
import { ZoomIndicator } from "./canvas/ZoomIndicator"
import { useViewport } from "./canvas/useViewport"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  boardId: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Top-level board layout that composes:
 *
 *  ┌──────────────────────────────────────────┐
 *  │  [BoardHeader]               top bar      │  ← Plan 07+
 *  │                                           │
 *  │  [Toolbar]  CanvasStage (infinite canvas) │
 *  │             ↑ full-screen, absolute       │
 *  │                                           │
 *  │                      [PresenceBar] (tr)   │  ← Plan 09+
 *  │                      [ZoomControls] (br)  │
 *  │  [ZoomIndicator]     centre-bottom        │
 *  └──────────────────────────────────────────┘
 *
 * CursorOverlay (remote cursors, pointer-events: none) — Plan 08+
 */
export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const viewport = useViewport()

  return (
    <div
      id="board-canvas-root"
      className="board-canvas-root"
      style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}
    >
      {/* ── Canvas (absolute, full screen) ─── */}
      <CanvasStage boardId={boardId} />

      {/* ── Bottom-right: zoom controls ─── */}
      <div
        id="board-zoom-controls"
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        <ZoomControls viewport={viewport} />
      </div>

      {/* ── Transient zoom indicator ─── */}
      <ZoomIndicator />

      {/* ── Placeholder slots for future plans ─── */}
      {/* <Toolbar />           Plan 05 */}
      {/* <BoardHeader />       Plan 07 */}
      {/* <PresenceBar />       Plan 09 */}
      {/* <CursorOverlay />     Plan 08 */}
    </div>
  )
}
