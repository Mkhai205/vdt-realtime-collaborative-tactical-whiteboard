"use client"

import { useMemo, useCallback } from "react"
import { Layer } from "react-konva"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { ObjectRenderer } from "./objects/ObjectRenderer"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Konva Layer containing all board objects, sorted by `zIndex` (ascending).
 *
 * Object mutations triggered from this layer (drag, text edit) write directly
 * to the board store for optimistic rendering; socket emission will be wired
 * in Plan 08 (Realtime Sync).
 */
export function ObjectsLayer() {
  const objects = useBoardStore((s) => s.objects)
  const editingStates = useBoardStore((s) => s.editingStates)
  const { selectedIds, setSelectedIds, addToSelection, clearSelection } =
    useUIStore()

  // ── Sort objects by zIndex once per render ────────────────────────────────

  const sortedObjects = useMemo(() => {
    return [...objects.values()].sort((a, b) => a.zIndex - b.zIndex)
  }, [objects])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      if (multi) {
        if (selectedIds.has(id)) {
          const next = new Set(selectedIds)
          next.delete(id)
          setSelectedIds(next)
        } else {
          addToSelection(id)
        }
      } else {
        setSelectedIds(new Set([id]))
      }
    },
    [selectedIds, setSelectedIds, addToSelection],
  )

  const handleStageClick = useCallback(
    (e: { target: { getStage: () => unknown } }) => {
      // Click on empty canvas → deselect all
      if (e.target === (e.target as { getStage: () => unknown }).getStage()) {
        clearSelection()
      }
    },
    [clearSelection],
  )

  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      // Optimistic position update — socket emit wired in Plan 08
      const obj = objects.get(id)
      if (!obj) return
      useBoardStore.getState().upsertObject({ ...obj, x, y })
    },
    [objects],
  )

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      // Optimistic text update — socket emit wired in Plan 08
      const obj = objects.get(id)
      if (!obj) return
      useBoardStore.getState().upsertObject({ ...obj, text })
    },
    [objects],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layer id="objects-layer" onClick={handleStageClick}>
      {sortedObjects.map((obj) => (
        <ObjectRenderer
          key={obj.id}
          object={obj}
          isSelected={selectedIds.has(obj.id)}
          isEditedByOther={editingStates.has(obj.id)}
          onSelect={handleSelect}
          onDragEnd={handleDragEnd}
          onTextChange={handleTextChange}
        />
      ))}
    </Layer>
  )
}
