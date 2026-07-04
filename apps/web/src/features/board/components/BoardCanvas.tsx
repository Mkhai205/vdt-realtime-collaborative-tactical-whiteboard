"use client"

import dynamic from "next/dynamic"

const CanvasStage = dynamic(
  () => import("./canvas/CanvasStage").then((mod) => mod.CanvasStage),
  { ssr: false }
)
import { ZoomControls } from "./canvas/ZoomControls"
import { ZoomIndicator } from "./canvas/ZoomIndicator"
import { UndoRedoControls } from "./canvas/UndoRedoControls"
import { StylePanel } from "./toolbar/StylePanel"
import { SelectionBadge } from "./canvas/SelectionBadge"
import { useViewport } from "./canvas/useViewport"

import { useBoardSocket } from "../hooks/useBoardSocket"
import { useObjectMutations } from "../hooks/useObjectMutations"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { ConnectionStatus } from "./canvas/ConnectionStatus"
import { CursorOverlay } from "@/features/cursor/components/CursorOverlay"
import { BoardHeader } from "./BoardHeader"

// ─── Floating hint overlay ───────────────────────────────────────────────────

function TextEditingHint() {
  const selectedIds = useUIStore((s) => s.selectedIds)
  const editingTextId = useUIStore((s) => s.editingTextId)
  const objects = useBoardStore((s) => s.objects)

  if (editingTextId) {
    return (
      <div
        id="text-editing-hint"
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          pointerEvents: "none",
          color: "rgba(0, 0, 0, 0.4)",
          fontSize: "12px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 500,
          userSelect: "none",
        }}
      >
        Press <kbd style={{ background: "rgba(0,0,0,0.06)", padding: "2px 5px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.12)", fontSize: "10px", fontWeight: "bold" }}>Esc</kbd> or <kbd style={{ background: "rgba(0,0,0,0.06)", padding: "2px 5px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.12)", fontSize: "10px", fontWeight: "bold" }}>Ctrl + Enter</kbd> to finish editing
      </div>
    )
  }

  if (selectedIds.size === 1) {
    const selectedId = Array.from(selectedIds)[0]
    if (selectedId) {
      const selectedObject = objects.get(selectedId)
      if (selectedObject?.type === "TEXT") {
        return (
          <div
            id="text-editing-hint"
            style={{
              position: "absolute",
              top: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100,
              pointerEvents: "none",
              color: "rgba(0, 0, 0, 0.4)",
              fontSize: "12px",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              userSelect: "none",
            }}
          >
            Double click or press <kbd style={{ background: "rgba(0,0,0,0.06)", padding: "2px 5px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.12)", fontSize: "10px", fontWeight: "bold" }}>Enter</kbd> to edit text
          </div>
        )
      }
    }
  }

  return null
}

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
      {/* ── Floating Text Editing Hint ── */}
      <TextEditingHint />

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
        <StylePanel mutations={mutations} />
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

