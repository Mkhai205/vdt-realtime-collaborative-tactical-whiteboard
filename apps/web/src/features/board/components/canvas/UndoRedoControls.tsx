"use client"

import { Undo2, Redo2 } from "lucide-react"
import { useBoardStore } from "@/stores/board.store"

interface UndoRedoControlsProps {
  mutations: {
    undo: () => void
    redo: () => void
  }
}

export function UndoRedoControls({ mutations }: UndoRedoControlsProps) {
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  return (
    <div
      id="undo-redo-controls"
      className="undo-redo-controls"
      role="group"
      aria-label="History controls"
    >
      {/* Undo */}
      <button
        id="undo-btn"
        className="zoom-btn"
        disabled={isViewer}
        onClick={mutations.undo}
        aria-label="Undo"
        title={isViewer ? "Undo (Disabled)" : "Undo (Ctrl+Z)"}
        style={{
          opacity: isViewer ? 0.4 : undefined,
          cursor: isViewer ? "not-allowed" : undefined,
        }}
      >
        <Undo2 size={14} />
      </button>

      {/* Redo */}
      <button
        id="redo-btn"
        className="zoom-btn"
        disabled={isViewer}
        onClick={mutations.redo}
        aria-label="Redo"
        title={isViewer ? "Redo (Disabled)" : "Redo (Ctrl+Y)"}
        style={{
          opacity: isViewer ? 0.4 : undefined,
          cursor: isViewer ? "not-allowed" : undefined,
        }}
      >
        <Redo2 size={14} />
      </button>
    </div>
  )
}
