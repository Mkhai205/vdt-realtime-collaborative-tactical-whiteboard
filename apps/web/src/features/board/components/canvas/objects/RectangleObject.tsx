"use client"

import { Rect, Group } from "react-konva"
import type { BoardObjectDto } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RectangleObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  isEditedByOther: boolean
  onSelect: (id: string, multi: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

// ─── Selection / editing highlight colours ─────────────────────────────────────

const SELECTION_STROKE = "#6366f1"
const EDIT_LOCK_STROKE = "#3b82f6"
const EDIT_LOCK_FILL = "rgba(59,130,246,0.08)"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a single RECTANGLE board object as a Konva Rect.
 * Handles drag and selection click; Transformer wiring lives in Plan 06.
 */
export function RectangleObject({
  object,
  isSelected,
  isEditedByOther,
  onSelect,
  onDragEnd,
}: RectangleObjectProps) {
  const s = resolveStyle("RECTANGLE", object.style)
  const w = object.width ?? 120
  const h = object.height ?? 80

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      width={w}
      height={h}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditedByOther}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {/* Main shape */}
      <Rect
        width={w}
        height={h}
        fill={s.fill}
        stroke={isSelected ? SELECTION_STROKE : s.stroke}
        strokeWidth={isSelected ? Math.max(s.strokeWidth, 2) : s.strokeWidth}
        cornerRadius={4}
        perfectDrawEnabled={false}
        shadowEnabled={false}
        dash={isEditedByOther ? [6, 4] : undefined}
      />

      {/* Editing-by-other overlay */}
      {isEditedByOther && (
        <Rect
          width={w}
          height={h}
          fill={EDIT_LOCK_FILL}
          stroke={EDIT_LOCK_STROKE}
          strokeWidth={2}
          dash={[6, 4]}
          cornerRadius={4}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  )
}
