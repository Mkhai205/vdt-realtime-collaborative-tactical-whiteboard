import { memo } from "react"
import { Line, Group } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"
import { getAvatarColor } from "@/lib/utils"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PathObjectProps {
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
 * Renders a PATH board object as a smooth Konva Line.
 *
 * points — flat [x1,y1,x2,y2,...] array stored in object.points (world space or relative space).
 * tension=0.3 gives a natural freehand feel; set to 0 for sharp polylines.
 */
export const PathObject = memo(function PathObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PathObjectProps) {
  const s = resolveStyle("PATH", object.style)
  const pts = safePoints(object.points)

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  if (pts.length < 4) return null

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser ? getAvatarColor(editingUser.id) : EDIT_LOCK_STROKE
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
  const minX = Math.min(...xCoords)
  const minY = Math.min(...yCoords)
  const maxX = Math.max(...xCoords)
  const maxY = Math.max(...yCoords)
  const originalWidth = maxX - minX
  const originalHeight = maxY - minY

  // Relativize points for drawing and scaling: shift them to be relative to minX, minY
  const relativePts = pts.map((val, idx) => {
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
      {/* Wide transparent hit area for easier clicking */}
      <Line
        points={relativePts}
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
        points={relativePts}
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
          x={originalWidth - badgeWidth}
          y={-20}
          name={editingUser.name}
          color={borderStroke}
        />
      )}
    </Group>
  )
})
