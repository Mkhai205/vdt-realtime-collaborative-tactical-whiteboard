"use client"

import { CanvasStage } from "./canvas/CanvasStage"
import { ZoomControls } from "./canvas/ZoomControls"
import { ZoomIndicator } from "./canvas/ZoomIndicator"
import { Toolbar } from "./toolbar/Toolbar"
import { StylePanel } from "./toolbar/StylePanel"
import { SelectionBadge } from "./canvas/SelectionBadge"
import { useViewport } from "./canvas/useViewport"

import { useBoardSocket } from "../hooks/useBoardSocket"
import { useObjectMutations } from "../hooks/useObjectMutations"
import { ConnectionStatus } from "./canvas/ConnectionStatus"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  boardId: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Top-level board layout:
 *
 *  ┌──────────────────────────────────────────────────┐
 *  │  [BoardHeader]                      top bar       │  ← Plan 07+
 *  │                                                   │
 *  │  [Toolbar]   CanvasStage (infinite canvas)        │
 *  │  [StylePanel]  ↑ full-screen, absolute            │
 *  │                                                   │
 *  │                         [PresenceBar] (top-right) │  ← Plan 09+
 *  │                         [ZoomControls] (br)       │
 *  │  [ZoomIndicator]        centre-bottom             │
 *  └──────────────────────────────────────────────────┘
 *
 * CursorOverlay (remote cursors, pointer-events: none) — Plan 08+
 */
export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const viewport = useViewport()

  // Realtime Sync & mutations hooks
  const { connectionStatus } = useBoardSocket(boardId)
  const mutations = useObjectMutations(boardId)

  return (
    <div
      id="board-canvas-root"
      className="board-canvas-root"
      style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}
    >
      {/* ── Canvas (absolute, full screen) ─── */}
      <CanvasStage boardId={boardId} mutations={mutations} />

      {/* ── Left: floating toolbar + style panel ─── */}
      <div
        id="board-left-panel"
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <Toolbar />
        <StylePanel />
      </div>

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

      {/* ── Selection count badge (shown when 2+ objects selected) ─── */}
      <SelectionBadge mutations={mutations} />

      {/* ── Connection status indicator ─── */}
      <ConnectionStatus status={connectionStatus} />

      {/* ── Placeholder slots for future plans ─── */}
      {/* <BoardHeader />       Plan 07 */}
      {/* <PresenceBar />       Plan 09 */}
      {/* <CursorOverlay />     Plan 08 */}
    </div>
  )
}
