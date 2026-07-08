import { useEffect, useRef } from "react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { type UseViewportReturn } from "@/features/board/components/canvas/useViewport"
import type {
  BoardObjectDto,
  ObjectCreatePayload,
  ObjectUpdatePatch,
} from "@rctw/shared-contracts"

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
export function useKeyboardActions(
  mutations: {
    createObject: (
      payload: ObjectCreatePayload,
      selectMode?: "replace" | "add" | "none",
    ) => void
    updateObject: (id: string, patch: ObjectUpdatePatch) => void
    deleteObject: (id: string) => void
    deleteObjectBatch: (ids: string[]) => void
    undo: () => void
    redo: () => void
  },
  viewport: UseViewportReturn,
) {
  const mutationsRef = useRef(mutations)

  useEffect(() => {
    mutationsRef.current = mutations
  }, [mutations])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return

      const {
        selectedIds,
        clearSelection,
        setSelectedIds,
        setActiveTool,
        clipboard,
        setClipboard,
        previewSnapshot,
      } = useUIStore.getState()
      const { objects, effectiveRole } = useBoardStore.getState()
      const isViewer =
        effectiveRole === "VIEWER" ||
        effectiveRole === "PUBLIC_VIEWER" ||
        !!previewSnapshot

      // ── Shift + 1 — zoom to fit all content ────────────────────────────────
      if (e.shiftKey && e.key === "1") {
        e.preventDefault()
        viewport.fitToObjects()
        return
      }

      // ── Delete / Backspace — remove selected objects ─────────────────────

      if (e.key === "Delete" || e.key === "Backspace") {
        if (isViewer) return
        if (selectedIds.size === 0) return
        e.preventDefault()
        if (selectedIds.size === 1) {
          // Single delete: giữ nguyên flow cũ (backward compatible)
          const [singleId] = selectedIds
          if (singleId) mutationsRef.current.deleteObject(singleId)
        } else {
          // Batch delete: 1 socket event cho tất cả
          mutationsRef.current.deleteObjectBatch([...selectedIds])
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
        if (isViewer) return
        for (const id of selectedIds) {
          const obj = objects.get(id)
          if (obj) {
            mutationsRef.current.updateObject(id, {
              x: obj.x + dx,
              y: obj.y + dy,
            })
          }
        }
        return
      }

      // ── Ctrl / Cmd shortcuts ──────────────────────────────────────────────

      if (!e.ctrlKey && !e.metaKey) return

      switch (e.key.toLowerCase()) {
        // Ctrl+0 — reset zoom to 100%
        case "0": {
          e.preventDefault()
          viewport.resetZoom()
          break
        }

        // Ctrl+A — select all
        case "a": {
          if (isViewer) break
          e.preventDefault()
          const allIds = new Set([...objects.keys()])
          setSelectedIds(allIds)
          break
        }

        // Ctrl+Z — undo
        case "z": {
          if (isViewer) break
          e.preventDefault()
          if (e.shiftKey) {
            mutationsRef.current.redo()
          } else {
            mutationsRef.current.undo()
          }
          break
        }

        // Ctrl+Y — redo
        case "y": {
          if (isViewer) break
          e.preventDefault()
          mutationsRef.current.redo()
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
          if (isViewer) break
          if (clipboard.length === 0) break
          e.preventDefault()
          // Clear current selection so the pasted items will be the only selected ones
          clearSelection()

          for (const src of clipboard) {
            const payload = {
              type: src.type,
              x: src.x + 20,
              y: src.y + 20,
              width: src.width ?? undefined,
              height: src.height ?? undefined,
              points: src.points ?? undefined,
              text: src.text ?? undefined,
              rotation: src.rotation,
              style: src.style,
              zIndex: objects.size,
            }
            mutationsRef.current.createObject(payload, "add")
          }
          break
        }

        default:
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [viewport])
}
