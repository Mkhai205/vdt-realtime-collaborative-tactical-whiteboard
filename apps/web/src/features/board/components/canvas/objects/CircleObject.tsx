import { Ellipse, Group } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"

import { useBoardStore } from "@/stores/board.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CircleObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

const EDIT_LOCK_STROKE = "#3b82f6"
const EDIT_LOCK_FILL = "rgba(59,130,246,0.08)"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a CIRCLE board object as a Konva Ellipse.
 * width / height are stored independently so the shape can be a true ellipse.
 * The Ellipse origin is its center, so the Group is offset by -radiusX/-radiusY
 * so that (object.x, object.y) maps to the top-left like all other shapes.
 *
 * Selection highlight is handled by the Konva Transformer in SelectionLayer.
 */
export function CircleObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragEnd,
}: CircleObjectProps) {
  const s = resolveStyle("CIRCLE", object.style)
  const w = object.width ?? 100
  const h = object.height ?? 100
  const rx = w / 2
  const ry = h / 2

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  // Suppress unused — kept for future hover/focus states
  void isSelected

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser?.avatarColor || EDIT_LOCK_STROKE
  const borderFill = editingUser?.avatarColor ? `${editingUser.avatarColor}14` : EDIT_LOCK_FILL
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  return (
    <Group
      id={object.id}
      // Shift so (x,y) = top-left corner, then centre the ellipse
      x={object.x + rx}
      y={object.y + ry}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditedByOther && !isViewer}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDragStart={() => onDragStart(object.id)}
      onDragEnd={(e) =>
        // Re-derive top-left from center
        onDragEnd(object.id, e.target.x() - rx, e.target.y() - ry)
      }
    >
      <Ellipse
        radiusX={rx}
        radiusY={ry}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        perfectDrawEnabled={false}
        shadowEnabled={false}
        dash={isEditedByOther ? [6, 4] : undefined}
      />

      {isEditedByOther && (
        <>
          <Ellipse
            radiusX={rx}
            radiusY={ry}
            fill={borderFill}
            stroke={borderStroke}
            strokeWidth={2}
            dash={[6, 4]}
            listening={false}
            perfectDrawEnabled={false}
          />
          <EditingBadge
            x={rx - badgeWidth}
            y={-ry - 20}
            name={editingUser.name}
            color={borderStroke}
          />
        </>
      )}
    </Group>
  )
}
