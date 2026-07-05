"use client"

import { useEffect, useRef, useState, memo } from "react"
import { createPortal } from "react-dom"
import { Text as KonvaText, Group, Rect } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"
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
  onTextChange: (id: string, text: string, width?: number, height?: number) => void
}

const EDIT_LOCK_STROKE = "#3b82f6"
const EDIT_LOCK_FILL = "rgba(59,130,246,0.08)"

// ─── Component ─────────────────────────────────────────────────────────────────

export const TextObject = memo(function TextObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTextChange,
}: TextObjectProps) {
  const s = resolveStyle("TEXT", object.style)
  const w = object.width ?? 160
  const h = object.height ?? 40

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  const viewport = useUIStore((s) => s.viewport)
  const editingTextId = useUIStore((s) => s.editingTextId)
  const setEditingTextId = useUIStore((s) => s.setEditingTextId)

  const isEditing = editingTextId === object.id
  const [editVal, setEditVal] = useState(object.text ?? "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser?.avatarColor || EDIT_LOCK_STROKE
  const borderFill = editingUser?.avatarColor ? `${editingUser.avatarColor}14` : EDIT_LOCK_FILL
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  // Keep local state in sync when database value changes
  useEffect(() => {
    if (!isEditing) {
      setEditVal(object.text ?? "")
    }
  }, [object.text, isEditing])

  // Auto-focus and select all text when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleCommit = () => {
    setEditingTextId(null)
    onTextChange(object.id, editVal, w, h)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleCommit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      // Revert local value and exit
      setEditVal(object.text ?? "")
      setEditingTextId(null)
    }
  }

  // Double click on text -> edit mode
  const handleDblClick = () => {
    if (isViewer || isEditedByOther) return
    setEditingTextId(object.id)
  }

  // Calculate screen-space coordinates for DOM text editor overlay
  const screenX = viewport.x + object.x * viewport.scale
  const screenY = viewport.y + object.y * viewport.scale

  // Portal target container
  const container = typeof document !== "undefined" ? document.getElementById("canvas-stage-container") : null

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
        stroke={isSelected ? borderStroke : "transparent"}
        strokeWidth={1}
        dash={isSelected ? [4, 4] : undefined}
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

      {/* Local Editing HTML Textarea Overlay (Portalled to Canvas Stage Container) */}
      {isEditing &&
        container &&
        createPortal(
          <textarea
            ref={textareaRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${screenX}px, ${screenY}px) rotate(${object.rotation}deg) scale(${viewport.scale})`,
              transformOrigin: "top left",
              width: `${w}px`,
              height: `${h}px`,
              fontSize: `${s.fontSize ?? 16}px`,
              fontFamily: s.fontFamily ?? "Inter, sans-serif",
              fontWeight: s.fontWeight === "bold" ? "bold" : "normal",
              color: s.color ?? "#1f2937",
              background: "rgba(255, 255, 255, 0.95)",
              border: "1px dashed #6366f1",
              borderRadius: "4px",
              outline: "none",
              resize: "none",
              lineHeight: 1.2,
              padding: "2px",
              margin: 0,
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              zIndex: 9999,
            }}
          />,
          container,
        )}
    </Group>
  )
})
