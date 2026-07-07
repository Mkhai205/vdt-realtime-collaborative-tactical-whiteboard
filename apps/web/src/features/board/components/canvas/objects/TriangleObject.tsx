import { memo } from "react"
import { Line, Group } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"
import { getAvatarColor } from "@/lib/utils"

import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TriangleObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

// ─── Selection / editing highlight colours ─────────────────────────────────────

const EDIT_LOCK_STROKE = "#3b82f6"
const EDIT_LOCK_FILL = "rgba(59,130,246,0.08)"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a single TRIANGLE board object as a Konva closed Line.
 * Selection highlight is handled by the Konva Transformer in SelectionLayer.
 */
export const TriangleObject = memo(function TriangleObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TriangleObjectProps) {
  const s = resolveStyle("TRIANGLE", object.style)
  const w = object.width ?? 100
  const h = object.height ?? 100

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  // Suppress unused — isSelected kept in props for future use (e.g. text highlight)
  void isSelected

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser ? getAvatarColor(editingUser.id) : EDIT_LOCK_STROKE
  const borderFill = editingUser ? `${getAvatarColor(editingUser.id)}14` : EDIT_LOCK_FILL
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  const points = [w / 2, 0, w, h, 0, h]

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      width={w}
      height={h}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditedByOther && !isViewer && isSelectTool}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDragStart={() => onDragStart(object.id)}
      onDragMove={(e) => onDragMove(object.id, e.target.x(), e.target.y(), e)}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {/* Main shape */}
      <Line
        points={points}
        closed
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        perfectDrawEnabled={false}
        shadowEnabled={false}
        dash={isEditedByOther ? [6, 4] : undefined}
      />

      {/* Editing-by-other overlay */}
      {isEditedByOther && (
        <>
          <Line
            points={points}
            closed
            fill={borderFill}
            stroke={borderStroke}
            strokeWidth={2}
            dash={[6, 4]}
            listening={false}
            perfectDrawEnabled={false}
          />
          <EditingBadge
            x={Math.max(0, w - badgeWidth)}
            y={-20}
            name={editingUser.name}
            color={borderStroke}
          />
        </>
      )}
    </Group>
  )
})
