"use client"

import { useEffect, useRef } from "react"
import { Layer, Transformer, Rect } from "react-konva"
import type Konva from "konva"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import type { UseLassoSelectReturn } from "@/features/board/hooks/useLassoSelect"
import type { UseTransformReturn } from "@/features/board/hooks/useTransform"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SelectionLayerProps {
  stageRef: React.RefObject<Konva.Stage | null>
  lassoSelect: UseLassoSelectReturn
  transform: UseTransformReturn
}

// ─── Transformer config ────────────────────────────────────────────────────────

const TRANSFORMER_CONFIG = {
  // Handle styling
  anchorSize: 8,
  anchorFill: "#ffffff",
  anchorStroke: "#6366f1",
  anchorStrokeWidth: 2,
  anchorCornerRadius: 2,

  // Border styling
  borderStroke: "#6366f1",
  borderStrokeWidth: 1.5,
  borderDash: [4, 4],

  // Rotation handle
  rotateEnabled: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
  rotationSnapTolerance: 5,

  // Resize
  keepRatio: false,
  enabledAnchors: [
    "top-left",
    "top-center",
    "top-right",
    "middle-right",
    "middle-left",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ] as string[],

  // Min size guard
  boundBoxFunc: (
    oldBox: { x: number; y: number; width: number; height: number; rotation: number },
    newBox: { x: number; y: number; width: number; height: number; rotation: number },
  ) => {
    if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
      return oldBox
    }
    return newBox
  },
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Konva Layer 2 — Selection handles.
 *
 * Contains:
 *  - A `Konva.Transformer` that wraps all currently selected nodes.
 *    Nodes are resolved from the stage using `stageRef` whenever `selectedIds` changes.
 *  - A `Konva.Rect` used as the lasso preview while drag-selecting.
 *
 * The Transformer is the single source of truth for resize/rotate visual.
 * It fires `onTransformEnd` which is handled by `useTransform`.
 */
export function SelectionLayer({ stageRef, lassoSelect, transform }: SelectionLayerProps) {
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const selectedIds = useUIStore((s) => s.selectedIds)
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  // ── Sync Transformer nodes whenever selectedIds changes ────────────────────

  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return


    if (selectedIds.size === 0) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }

    // Find Konva nodes by ID from the objects layer
    const nodes: Konva.Node[] = []
    for (const id of selectedIds) {
      const node = stage.findOne(`#${id}`)
      if (node) nodes.push(node)
    }

    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, stageRef])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layer id="selection-layer">
      {/* Transformer — resize/rotate handles */}
      <Transformer
        ref={transformerRef}
        {...TRANSFORMER_CONFIG}
        resizeEnabled={!isViewer}
        rotateEnabled={!isViewer}
        enabledAnchors={isViewer ? [] : TRANSFORMER_CONFIG.enabledAnchors}
        onTransformStart={transform.onTransformStart}
        onTransformEnd={transform.onTransformEnd}
      />


      <Rect
        // eslint-disable-next-line react-hooks/refs
        ref={lassoSelect.setLassoRect}
        id="lasso-rect"
        fill="rgba(99,102,241,0.08)"
        stroke="#6366f1"
        strokeWidth={1}
        dash={[4, 3]}
        visible={false}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Layer>
  )
}
