import { memo } from "react"
import { Arrow, Group } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"
import { getAvatarColor } from "@/lib/utils"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface LineObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

const SELECTION_STROKE = "#6366f1"
const EDIT_LOCK_STROKE = "#3b82f6"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a LINE board object as a Konva Arrow.
 *
 * points  — flat [x1,y1,x2,y2,...] in world-space or relative space; stored in object.points.
 * Arrow head presence is controlled by style.arrowEnd / style.arrowStart.
 * Default: arrowEnd=true, arrowStart=false.
 */
export const LineObject = memo(function LineObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: LineObjectProps) {
  const s = resolveStyle("LINE", object.style)
  const pts = safePoints(object.points)

  // Fallback: draw a short horizontal line so the object is always visible
  const rawPoints = pts.length >= 4 ? pts : [0, 0, 100, 0]

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser ? getAvatarColor(editingUser.id) : EDIT_LOCK_STROKE
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  const strokeColor = isEditedByOther ? borderStroke : s.stroke
  const strokeWidth = s.strokeWidth

  // Find bounds of the points to place editing badge and compute size
  const xCoords = rawPoints.filter((_, idx) => idx % 2 === 0)
  const yCoords = rawPoints.filter((_, idx) => idx % 2 === 1)
  const minX = Math.min(...xCoords)
  const minY = Math.min(...yCoords)
  const maxX = Math.max(...xCoords)
  const maxY = Math.max(...yCoords)
  const originalWidth = maxX - minX
  const originalHeight = maxY - minY

  // Relativize points: shift them to be relative to minX, minY
  const relativePts = rawPoints.map((val, idx) => {
    if (idx % 2 === 0) return val - minX
    return val - minY
  })

  // If width/height exist, the object has been relativized and we use object.x/y as the origin.
  // Otherwise, it is an old absolute object and we use minX/minY as the temporary origin.
  const groupX = object.width ? object.x : minX
  const groupY = object.height ? object.y : minY

  // Determine scaling factors relative to original bounding box
  const scaleX = object.width && originalWidth > 0 ? (object.width / originalWidth) : 1
  const scaleY = object.height && originalHeight > 0 ? (object.height / originalHeight) : 1

  return (
    <Group
      id={object.id}
      x={groupX}
      y={groupY}
      rotation={object.rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable={!isEditedByOther && !isViewer && isSelectTool}
      onDragStart={() => onDragStart(object.id)}
      onDragMove={(e) =>
        onDragMove(object.id, e.target.x(), e.target.y(), e)
      }
      onDragEnd={(e) =>
        onDragEnd(object.id, e.target.x(), e.target.y())
      }
    >
      {/* Hit-area shadow — wider invisible line for easier click targeting */}
      <Arrow
        points={relativePts}
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
        points={relativePts}
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
          x={originalWidth - badgeWidth}
          y={-20}
          name={editingUser.name}
          color={borderStroke}
        />
      )}
    </Group>
  )
})
