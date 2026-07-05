import { useCallback, useEffect } from "react"
import type { Tool } from "@rctw/shared-contracts"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"

// ─── Shortcut map ───────────────────────────────────────────────────────────────

const KEY_TO_TOOL: Record<string, Tool> = {
  v: "SELECT",
  h: "HAND",
  r: "RECTANGLE",
  c: "CIRCLE",
  l: "LINE",
  p: "PATH",
  i: "ICON",
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Registers global keyboard shortcuts for tool switching and
 * exposes a stable `selectTool` helper.
 *
 * Keyboard bindings (fires when no input/textarea is focused):
 *   V → SELECT   H → HAND
 *   R → RECTANGLE  C → CIRCLE  L → LINE
 *   P → PATH  I → ICON
 *   Escape → SELECT (cancel current tool / drawing)
 *   Delete / Backspace → delete all currently selected objects
 */
export function useTool() {
  const activeTool = useUIStore((s) => s.activeTool)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const clearSelection = useUIStore((s) => s.clearSelection)

  const selectTool = useCallback(
    (tool: Tool) => {
      setActiveTool(tool)
    },
    [setActiveTool],
  )

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip when typing in any input / contenteditable / textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return

      const role = useBoardStore.getState().effectiveRole
      const isViewer = role === "VIEWER" || role === "PUBLIC_VIEWER"

      // Tool shortcuts (single key, no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase()

        if (key === "escape") {
          e.preventDefault()
          setActiveTool("SELECT")
          return
        }



        const tool = KEY_TO_TOOL[key]
        if (tool) {
          if (isViewer && tool !== "SELECT" && tool !== "HAND") return
          e.preventDefault()
          setActiveTool(tool)
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setActiveTool, clearSelection])

  return { activeTool, selectTool }
}
