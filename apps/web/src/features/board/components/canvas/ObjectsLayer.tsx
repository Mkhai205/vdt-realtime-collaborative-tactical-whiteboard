"use client"

import { useMemo, useCallback } from "react"
import { Layer } from "react-konva"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { useDragMove } from "@/features/board/hooks/useDragMove"
import type { UseObjectMutationsReturn } from "@/features/board/hooks/useObjectMutations"
import { ObjectRenderer } from "./objects/ObjectRenderer"

// ─── Component ─────────────────────────────────────────────────────────────────

interface ObjectsLayerProps {
  mutations: UseObjectMutationsReturn
}

/**
 * Konva Layer containing all board objects, sorted by `zIndex` (ascending).
 *
 * Object mutations triggered from this layer (drag, text edit) write directly
 * to the board store for optimistic rendering; socket emission will be wired
 * in Plan 08 (Realtime Sync).
 *
 * Selection highlight is now fully handled by the Konva Transformer in
 * SelectionLayer; individual shapes no longer draw their own selection border.
 * The `isSelected` prop is still forwarded for text object focus border.
 */
export function ObjectsLayer({ mutations }: ObjectsLayerProps) {
  const objects = useBoardStore((s) => s.objects)
  const editingStates = useBoardStore((s) => s.editingStates)
  const { selectedIds, setSelectedIds, addToSelection, clearSelection } =
    useUIStore()

  const { onDragStart, onDragEnd } = useDragMove(
    mutations.updateObject,
    mutations.setObjectEditingState,
  )

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

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      mutations.updateObject(id, { text })
    },
    [mutations],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layer id="objects-layer" onClick={handleStageClick}>
      {sortedObjects.map((obj) => (
        <ObjectRenderer
          key={obj.id}
          object={obj}
          isSelected={selectedIds.has(obj.id)}
          editingUser={editingStates.get(obj.id)?.user}
          onSelect={handleSelect}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onTextChange={handleTextChange}
          setObjectEditingState={mutations.setObjectEditingState}
        />
      ))}
    </Layer>
  )
}
