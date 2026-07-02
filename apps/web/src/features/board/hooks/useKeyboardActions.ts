import { useEffect } from "react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import type { BoardObjectDto } from "@rctw/shared-contracts"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function newLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Returns true when the active element is an input/textarea (avoid triggering shortcuts) */
function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Global keyboard shortcuts while the canvas is active.
 *
 * All handlers guard against `isInputFocused()` so shortcuts don't fire
 * while the user is typing in text boxes or the inline text editor.
 *
 * Mutations are optimistic (board store only); socket events wired in Plan 08.
 */
export function useKeyboardActions() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return

      const { selectedIds, clearSelection, setSelectedIds, setActiveTool, clipboard, setClipboard } =
        useUIStore.getState()
      const { objects, upsertObject, removeObject } = useBoardStore.getState()

      // ── Delete / Backspace — remove selected objects ────────────────────────

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size === 0) return
        e.preventDefault()
        for (const id of selectedIds) {
          removeObject(id)
        }
        clearSelection()
        return
      }

      // ── Escape — clear selection or switch to SELECT tool ──────────────────

      if (e.key === "Escape") {
        e.preventDefault()
        if (selectedIds.size > 0) {
          clearSelection()
        } else {
          setActiveTool("SELECT")
        }
        return
      }

      // ── Arrow keys — nudge selected objects ───────────────────────────────

      const NUDGE = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        dx = -NUDGE
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        dx = NUDGE
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        dy = -NUDGE
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        dy = NUDGE
      }

      if (dx !== 0 || dy !== 0) {
        for (const id of selectedIds) {
          const obj = objects.get(id)
          if (obj) {
            upsertObject({ ...obj, x: obj.x + dx, y: obj.y + dy })
          }
        }
        return
      }

      // ── Ctrl / Cmd shortcuts ──────────────────────────────────────────────

      if (!e.ctrlKey && !e.metaKey) return

      switch (e.key.toLowerCase()) {
        // Ctrl+A — select all
        case "a": {
          e.preventDefault()
          const allIds = new Set([...objects.keys()])
          setSelectedIds(allIds)
          break
        }

        // Ctrl+Z — undo (optimistic: just reset store; socket undo in Plan 08)
        case "z": {
          e.preventDefault()
          if (e.shiftKey) {
            // Ctrl+Shift+Z → redo (stub — socket emit in Plan 08)
            // useBoardStore.getState().emitRedo?.()
          } else {
            // Ctrl+Z → undo (stub — socket emit in Plan 08)
            // useBoardStore.getState().emitUndo?.()
          }
          break
        }

        // Ctrl+Y — redo
        case "y": {
          e.preventDefault()
          // Redo stub — socket emit in Plan 08
          // useBoardStore.getState().emitRedo?.()
          break
        }

        // Ctrl+C — copy selected objects to clipboard
        case "c": {
          if (selectedIds.size === 0) break
          e.preventDefault()
          const copied: BoardObjectDto[] = []
          for (const id of selectedIds) {
            const obj = objects.get(id)
            if (obj) copied.push(obj)
          }
          setClipboard(copied)
          break
        }

        // Ctrl+V — paste clipboard with +20/+20 offset
        case "v": {
          if (clipboard.length === 0) break
          e.preventDefault()
          const now = new Date().toISOString()
          const pastedIds = new Set<string>()

          for (const src of clipboard) {
            const newId = newLocalId()
            pastedIds.add(newId)
            upsertObject({
              ...src,
              id: newId,
              x: src.x + 20,
              y: src.y + 20,
              version: 1,
              createdAt: now,
              updatedAt: now,
            })
          }

          setSelectedIds(pastedIds)
          break
        }

        default:
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
}
