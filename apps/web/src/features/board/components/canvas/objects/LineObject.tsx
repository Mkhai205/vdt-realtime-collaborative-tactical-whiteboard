"use client"

import { Arrow, Group } from "react-konva"
import type { BoardObjectDto } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface LineObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  isEditedByOther: boolean
  onSelect: (id: string, multi: boolean) => void
}

const SELECTION_STROKE = "#6366f1"
const EDIT_LOCK_STROKE = "#3b82f6"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a LINE board object as a Konva Arrow.
 *
 * points  — flat [x1,y1,x2,y2,...] in world-space; stored in object.points.
 * The Arrow origin is the Stage (not a Group), so no position offset is needed:
 * points are already in world coordinates.
 *
 * Arrow head presence is controlled by style.arrowEnd / style.arrowStart.
 * Default: arrowEnd=true, arrowStart=false.
 */
export function LineObject({
  object,
  isSelected,
  isEditedByOther,
  onSelect,
}: LineObjectProps) {
  const s = resolveStyle("LINE", object.style)
  const pts = safePoints(object.points)

  // Fallback: draw a short horizontal line so the object is always visible
  const points = pts.length >= 4 ? pts : [0, 0, 100, 0]

  const strokeColor = isSelected
    ? SELECTION_STROKE
    : isEditedByOther
      ? EDIT_LOCK_STROKE
      : s.stroke

  const strokeWidth = isSelected
    ? Math.max(s.strokeWidth, 2)
    : s.strokeWidth

  return (
    <Group id={object.id}>
      {/* Hit-area shadow — wider invisible line for easier click targeting */}
      <Arrow
        points={points}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth + 8, 12)}
        fill="transparent"
        pointerAtBeginning={false}
        pointerAtEnding={false}
        listening={true}
        perfectDrawEnabled={false}
        onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
        onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      />

      {/* Visible arrow */}
      <Arrow
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={strokeColor}
        opacity={s.opacity}
        pointerAtBeginning={s.arrowStart}
        pointerAtEnding={s.arrowEnd}
        pointerLength={12}
        pointerWidth={8}
        lineCap="round"
        lineJoin="round"
        dash={isEditedByOther ? [6, 4] : undefined}
        listening={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    </Group>
  )
}
