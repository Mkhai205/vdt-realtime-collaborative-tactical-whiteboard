import { memo, useEffect, useState } from "react"
import { Image as KonvaImage, Group, Rect, Text } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"

import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ImageObjectProps {
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
 * Renders a single IMAGE board object as a Konva Image.
 * Handles loading states and broken images gracefully.
 */
export const ImageObject = memo(function ImageObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ImageObjectProps) {
  const s = resolveStyle("IMAGE", object.style)
  const w = object.width ?? 200
  const h = object.height ?? 200

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null)
  const [loadStatus, setLoadStatus] = useState<"loading" | "loaded" | "error">("loading")

  useEffect(() => {
    if (!s.assetUrl) {
      setLoadStatus("error")
      return
    }

    setLoadStatus("loading")
    const img = new window.Image()
    img.src = s.assetUrl

    img.onload = () => {
      setImageEl(img)
      setLoadStatus("loaded")
    }

    img.onerror = () => {
      setImageEl(null)
      setLoadStatus("error")
    }
  }, [s.assetUrl])

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  // Suppress unused — isSelected kept in props for future use
  void isSelected

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser?.avatarColor || EDIT_LOCK_STROKE
  const borderFill = editingUser?.avatarColor ? `${editingUser.avatarColor}14` : EDIT_LOCK_FILL
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

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
      {/* Loading state placeholder */}
      {loadStatus === "loading" && (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#f3f4f6"
            stroke="#d1d5db"
            strokeWidth={1}
            dash={[4, 4]}
            cornerRadius={4}
          />
          <Text
            text="Loading image..."
            fontSize={12}
            fontFamily="Inter, sans-serif"
            fill="#9ca3af"
            align="center"
            verticalAlign="middle"
            width={w}
            height={h}
          />
        </Group>
      )}

      {/* Error / Missing URL placeholder */}
      {loadStatus === "error" && (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#fef2f2"
            stroke="#fca5a5"
            strokeWidth={1.5}
            cornerRadius={4}
          />
          <Text
            text="⚠️ Failed to load image"
            fontSize={12}
            fontFamily="Inter, sans-serif"
            fill="#ef4444"
            align="center"
            verticalAlign="middle"
            width={w}
            height={h}
          />
        </Group>
      )}

      {/* Actual image */}
      {loadStatus === "loaded" && imageEl && (
        <KonvaImage
          image={imageEl}
          width={w}
          height={h}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      )}

      {/* Editing-by-other overlay */}
      {isEditedByOther && (
        <>
          <Rect
            width={w}
            height={h}
            fill={borderFill}
            stroke={borderStroke}
            strokeWidth={2}
            dash={[6, 4]}
            cornerRadius={4}
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
