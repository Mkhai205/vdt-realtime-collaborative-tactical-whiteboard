"use client"

import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * HTML overlay badge shown at bottom-center when 2+ objects are selected.
 *
 * Intentionally rendered as a React DOM element (not Konva) so it sits on top
 * of the canvas with normal CSS positioning and receives pointer events.
 *
 * Layout:
 *   ✦ N objects selected    [Delete all]
 */
export function SelectionBadge() {
  const selectedIds = useUIStore((s) => s.selectedIds)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const removeObject = useBoardStore((s) => s.removeObject)

  const count = selectedIds.size
  if (count < 2) return null

  const handleDeleteAll = () => {
    for (const id of selectedIds) {
      removeObject(id)
    }
    clearSelection()
  }

  return (
    <div
      id="selection-badge"
      style={{
        position: "absolute",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        pointerEvents: "auto",

        // Glassmorphism card
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        borderRadius: 999,
        background: "rgba(15, 15, 25, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(99, 102, 241, 0.35)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.1)",

        // Typography
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        color: "rgba(255,255,255,0.9)",

        // Entrance animation
        animation: "selection-badge-in 0.18s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      {/* Icon + count */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#6366f1",
            display: "inline-block",
            boxShadow: "0 0 6px rgba(99,102,241,0.8)",
          }}
        />
        <strong style={{ color: "#a5b4fc" }}>{count}</strong>
        &nbsp;objects selected
      </span>

      {/* Divider */}
      <span
        style={{
          width: 1,
          height: 16,
          background: "rgba(255,255,255,0.12)",
          flexShrink: 0,
        }}
      />

      {/* Delete button */}
      <button
        id="selection-badge-delete"
        onClick={handleDeleteAll}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 6px",
          borderRadius: 6,
          color: "rgba(248,113,113,0.9)",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background =
            "rgba(239,68,68,0.15)"
          ;(e.currentTarget as HTMLButtonElement).style.color = "#f87171"
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = "none"
          ;(e.currentTarget as HTMLButtonElement).style.color =
            "rgba(248,113,113,0.9)"
        }}
      >
        Delete all
      </button>

      {/* CSS animation */}
      <style>{`
        @keyframes selection-badge-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  )
}
