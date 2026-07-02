"use client"

import { Line, Group } from "react-konva"
import type { BoardObjectDto } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PathObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  isEditedByOther: boolean
  onSelect: (id: string, multi: boolean) => void
}

const SELECTION_STROKE = "#6366f1"
const EDIT_LOCK_STROKE = "#3b82f6"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a PATH board object as a smooth Konva Line.
 *
 * points — flat [x1,y1,x2,y2,...] array stored in object.points (world space).
 * tension=0.3 gives a natural freehand feel; set to 0 for sharp polylines.
 */
export function PathObject({
  object,
  isSelected,
  isEditedByOther,
  onSelect,
}: PathObjectProps) {
  const s = resolveStyle("PATH", object.style)
  const pts = safePoints(object.points)

  if (pts.length < 4) return null

  const strokeColor = isSelected
    ? SELECTION_STROKE
    : isEditedByOther
      ? EDIT_LOCK_STROKE
      : s.stroke

  const strokeWidth = isSelected ? Math.max(s.strokeWidth, 2) : s.strokeWidth

  return (
    <Group id={object.id}>
      {/* Wide transparent hit area for easier clicking */}
      <Line
        points={pts}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth + 10, 14)}
        tension={0.3}
        lineCap="round"
        lineJoin="round"
        listening={true}
        perfectDrawEnabled={false}
        onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
        onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      />

      {/* Visible path */}
      <Line
        points={pts}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={s.opacity}
        tension={0.3}
        lineCap="round"
        lineJoin="round"
        closed={false}
        dash={isEditedByOther ? [6, 4] : undefined}
        listening={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    </Group>
  )
}
