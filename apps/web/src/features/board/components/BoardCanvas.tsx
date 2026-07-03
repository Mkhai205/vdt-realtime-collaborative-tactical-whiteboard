"use client"

import { CanvasStage } from "./canvas/CanvasStage"
import { ZoomControls } from "./canvas/ZoomControls"
import { ZoomIndicator } from "./canvas/ZoomIndicator"
import { UndoRedoControls } from "./canvas/UndoRedoControls"
import { StylePanel } from "./toolbar/StylePanel"
import { SelectionBadge } from "./canvas/SelectionBadge"
import { useViewport } from "./canvas/useViewport"

import { useBoardSocket } from "../hooks/useBoardSocket"
import { useObjectMutations } from "../hooks/useObjectMutations"
import { ConnectionStatus } from "./canvas/ConnectionStatus"
import { CursorOverlay } from "@/features/cursor/components/CursorOverlay"
import { BoardHeader } from "./BoardHeader"

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
      {/* ── Header Top Bar ── */}
      <BoardHeader boardId={boardId} />

      {/* ── Canvas (absolute, full screen) ─── */}
      <CanvasStage boardId={boardId} mutations={mutations} />

      {/* ── Left: style panel (floating solo) ─── */}
      <div
        id="board-left-panel"
        style={{
          position: "absolute",
          left: 16,
          top: 80,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          pointerEvents: "auto",
        }}
      >
        <StylePanel updateObject={mutations.updateObject} />
      </div>

      {/* ── Bottom-left: zoom & history controls ─── */}
      <div
        id="board-bottom-left"
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <ZoomControls viewport={viewport} />
        <UndoRedoControls mutations={mutations} />
      </div>

      {/* ── Transient zoom indicator ─── */}
      <ZoomIndicator />

      {/* ── Selection count badge (shown when 2+ objects selected) ─── */}
      <SelectionBadge mutations={mutations} />

      {/* ── Connection status indicator ─── */}
      <ConnectionStatus status={connectionStatus} />

      {/* ── Remote Cursor Overlay ─── */}
      <CursorOverlay boardId={boardId} />
    </div>
  )
}

