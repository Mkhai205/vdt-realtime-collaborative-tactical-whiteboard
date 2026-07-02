import { Arrow, Group } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface LineObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
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
  editingUser,
  onSelect,
}: LineObjectProps) {
  const s = resolveStyle("LINE", object.style)
  const pts = safePoints(object.points)

  // Fallback: draw a short horizontal line so the object is always visible
  const points = pts.length >= 4 ? pts : [0, 0, 100, 0]

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser?.avatarColor || EDIT_LOCK_STROKE
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  const strokeColor = isSelected
    ? SELECTION_STROKE
    : isEditedByOther
      ? borderStroke
      : s.stroke

  const strokeWidth = isSelected
    ? Math.max(s.strokeWidth, 2)
    : s.strokeWidth

  // Find bounds of the points to place editing badge
  const xCoords = points.filter((_, idx) => idx % 2 === 0)
  const yCoords = points.filter((_, idx) => idx % 2 === 1)
  const maxX = Math.max(...xCoords)
  const minY = Math.min(...yCoords)

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
