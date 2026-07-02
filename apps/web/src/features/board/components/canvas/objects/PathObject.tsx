import { Line, Group } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PathObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
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
  editingUser,
  onSelect,
}: PathObjectProps) {
  const s = resolveStyle("PATH", object.style)
  const pts = safePoints(object.points)

  if (pts.length < 4) return null

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser?.avatarColor || EDIT_LOCK_STROKE
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  const strokeColor = isSelected
    ? SELECTION_STROKE
    : isEditedByOther
      ? borderStroke
      : s.stroke

  const strokeWidth = isSelected ? Math.max(s.strokeWidth, 2) : s.strokeWidth

  // Find bounds of the freehand path
  const xCoords = pts.filter((_, idx) => idx % 2 === 0)
  const yCoords = pts.filter((_, idx) => idx % 2 === 1)
  const maxX = Math.max(...xCoords)
  const minY = Math.min(...yCoords)

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

      {/* Editing-by-other badge */}
      {isEditedByOther && (
        <EditingBadge
          x={maxX - badgeWidth}
          y={minY - 20}
          name={editingUser.name}
          color={borderStroke}
        />
      )}
    </Group>
  )
}
