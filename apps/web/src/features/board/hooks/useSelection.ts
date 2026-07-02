import { useCallback } from "react"
import { useUIStore } from "@/stores/ui.store"

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Thin wrapper around UIStore selection actions.
 *
 * Provides semantic helpers for click-based single/multi select and deselect,
 * consumed by ObjectsLayer and useCanvasEvents.
 */
export function useSelection() {
  const { selectedIds, setSelectedIds, addToSelection, removeFromSelection, clearSelection } =
    useUIStore()

  /**
   * Handle a click on a board object.
   *
   * - shiftKey=true  → toggle the object in/out of the current selection
   * - shiftKey=false → replace selection with just this object
   */
  const onObjectClick = useCallback(
    (id: string, shiftKey: boolean) => {
      if (shiftKey) {
        if (selectedIds.has(id)) {
          removeFromSelection(id)
        } else {
          addToSelection(id)
        }
      } else {
        setSelectedIds(new Set([id]))
      }
    },
    [selectedIds, setSelectedIds, addToSelection, removeFromSelection],
  )

  /**
   * Called when the user clicks the bare stage background.
   * Clears the selection only when the click target IS the stage itself
   * (not bubbling from a child object).
   */
  const onStageClick = useCallback(
    (target: unknown, stage: unknown) => {
      if (target === stage) {
        clearSelection()
      }
    },
    [clearSelection],
  )

  return { selectedIds, onObjectClick, onStageClick, clearSelection }
}

export type UseSelectionReturn = ReturnType<typeof useSelection>
