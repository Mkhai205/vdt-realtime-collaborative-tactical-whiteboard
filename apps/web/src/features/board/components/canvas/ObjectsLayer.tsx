"use client"

import { useMemo, useCallback, memo } from "react"
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
export const ObjectsLayer = memo(function ObjectsLayer({ mutations }: ObjectsLayerProps) {
  const objects = useBoardStore((s) => s.objects)
  const editingStates = useBoardStore((s) => s.editingStates)
  
  const selectedIds = useUIStore((s) => s.selectedIds)
  const setSelectedIds = useUIStore((s) => s.setSelectedIds)
  const addToSelection = useUIStore((s) => s.addToSelection)
  const clearSelection = useUIStore((s) => s.clearSelection)

  const { onDragStart, onDragMove, onDragEnd } = useDragMove(
    mutations.updateObject,
    mutations.setObjectEditingState,
  )

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  // ── Sort objects by zIndex once per render ────────────────────────────────

  const sortedObjects = useMemo(() => {
    return [...objects.values()].sort((a, b) => a.zIndex - b.zIndex)
  }, [objects])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      if (isViewer) return
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
    [selectedIds, setSelectedIds, addToSelection, isViewer],
  )

  const handleStageClick = useCallback(
    (e: { target: { getStage: () => unknown } }) => {
      const { justCreatedShape, setJustCreatedShape } = useUIStore.getState()
      if (justCreatedShape) {
        setJustCreatedShape(false)
        return
      }

      // Click on empty canvas → deselect all
      if (e.target === (e.target as { getStage: () => unknown }).getStage()) {
        clearSelection()
      }
    },
    [clearSelection],
  )

  const handleTextChange = useCallback(
    (id: string, text: string, width?: number, height?: number) => {
      if (text.trim() === "") {
        mutations.deleteObject(id)
        clearSelection()
      } else {
        mutations.updateObject(id, {
          text,
          ...(width !== undefined && { width }),
          ...(height !== undefined && { height }),
        })
      }
    },
    [mutations, clearSelection],
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
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onTextChange={handleTextChange}
          setObjectEditingState={mutations.setObjectEditingState}
        />
      ))}
    </Layer>
  )
})
