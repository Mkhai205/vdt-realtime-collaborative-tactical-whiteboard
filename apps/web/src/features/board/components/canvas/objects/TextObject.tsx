"use client"

import { memo } from "react"
import { Text as KonvaText, Group, Rect } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"
import { getAvatarColor } from "@/lib/utils"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TextObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

const EDIT_LOCK_STROKE = "#3b82f6"
const EDIT_LOCK_FILL = "rgba(59,130,246,0.08)"

// ─── Component ─────────────────────────────────────────────────────────────────

export const TextObject = memo(function TextObject({
  object,
  isSelected: _isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TextObjectProps) {
  const s = resolveStyle("TEXT", object.style)
  const w = object.width ?? 160
  const h = object.height ?? 40

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  const editingTextId = useUIStore((s) => s.editingTextId)
  const setEditingTextId = useUIStore((s) => s.setEditingTextId)

  const isEditing = editingTextId === object.id

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser ? getAvatarColor(editingUser.id) : EDIT_LOCK_STROKE
  const borderFill = editingUser ? `${getAvatarColor(editingUser.id)}14` : EDIT_LOCK_FILL
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  // Double click on text -> edit mode
  const handleDblClick = () => {
    if (isViewer || isEditedByOther) return
    setEditingTextId(object.id)
  }

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      width={w}
      height={h}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditedByOther && !isViewer && isSelectTool && !isEditing}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragStart={() => onDragStart(object.id)}
      onDragMove={(e) => onDragMove(object.id, e.target.x(), e.target.y(), e)}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {/* Invisible background to make dragging/clicking easier */}
      <Rect
        width={w}
        height={h}
        fill="transparent"
      />

      {/* Actual Konva Text */}
      {!isEditing && (
        <KonvaText
          text={object.text ?? ""}
          width={w}
          height={h}
          fontSize={s.fontSize ?? 16}
          fontFamily={s.fontFamily ?? "Inter, sans-serif"}
          fontStyle={s.fontWeight === "bold" ? "bold" : "normal"}
          fill={s.color ?? "#1f2937"}
          align="left"
          verticalAlign="top"
          perfectDrawEnabled={false}
          shadowEnabled={false}
          listening={false}
        />
      )}

      {/* Editing overlay by other users */}
      {isEditedByOther && (
        <>
          <Rect
            width={w}
            height={h}
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
