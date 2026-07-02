"use client"

import { Ellipse, Group } from "react-konva"
import type { BoardObjectDto } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CircleObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  isEditedByOther: boolean
  onSelect: (id: string, multi: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

const SELECTION_STROKE = "#6366f1"
const EDIT_LOCK_STROKE = "#3b82f6"
const EDIT_LOCK_FILL = "rgba(59,130,246,0.08)"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a CIRCLE board object as a Konva Ellipse.
 * width / height are stored independently so the shape can be a true ellipse.
 * The Ellipse origin is its center, so the Group is offset by -radiusX/-radiusY
 * so that (object.x, object.y) maps to the top-left like all other shapes.
 */
export function CircleObject({
  object,
  isSelected,
  isEditedByOther,
  onSelect,
  onDragEnd,
}: CircleObjectProps) {
  const s = resolveStyle("CIRCLE", object.style)
  const w = object.width ?? 100
  const h = object.height ?? 100
  const rx = w / 2
  const ry = h / 2

  return (
    <Group
      id={object.id}
      // Shift so (x,y) = top-left corner, then centre the ellipse
      x={object.x + rx}
      y={object.y + ry}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditedByOther}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDragEnd={(e) =>
        // Re-derive top-left from center
        onDragEnd(object.id, e.target.x() - rx, e.target.y() - ry)
      }
    >
      <Ellipse
        radiusX={rx}
        radiusY={ry}
        fill={s.fill}
        stroke={isSelected ? SELECTION_STROKE : s.stroke}
        strokeWidth={isSelected ? Math.max(s.strokeWidth, 2) : s.strokeWidth}
        perfectDrawEnabled={false}
        shadowEnabled={false}
        dash={isEditedByOther ? [6, 4] : undefined}
      />

      {isEditedByOther && (
        <Ellipse
          radiusX={rx}
          radiusY={ry}
          fill={EDIT_LOCK_FILL}
          stroke={EDIT_LOCK_STROKE}
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  )
}
