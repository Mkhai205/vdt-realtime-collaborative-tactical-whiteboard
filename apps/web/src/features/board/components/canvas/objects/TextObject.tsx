"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Text, Group, Rect } from "react-konva"
import type Konva from "konva"
import type { BoardObjectDto } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TextObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  isEditedByOther: boolean
  onSelect: (id: string, multi: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  /** Called when user finishes editing to persist the new text */
  onTextChange: (id: string, text: string) => void
}

const SELECTION_STROKE = "#6366f1"
const MIN_WIDTH = 120
const MIN_HEIGHT = 40
const PADDING = 6

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a TEXT board object.
 *
 * Display mode : Konva Text node.
 * Edit mode    : Absolute-positioned HTML <textarea> overlaid on the canvas,
 *                transformed to match the current viewport scale so font size
 *                and position appear identical to the Konva text.
 *
 * The textarea is portalled to document.body so it sits above all Konva
 * layers without affecting layout.
 */
export function TextObject({
  object,
  isSelected,
  isEditedByOther,
  onSelect,
  onDragEnd,
  onTextChange,
}: TextObjectProps) {
  const s = resolveStyle("TEXT", object.style)
  const { viewport } = useUIStore()
  const textRef = useRef<Konva.Text>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  // editValue tracks in-progress keystrokes — only meaningful while isEditing.
  // We do NOT sync this from object.text; instead it is initialized fresh in enterEdit.
  const [editValue, setEditValue] = useState("")

  const w = object.width ?? MIN_WIDTH
  const h = object.height ?? MIN_HEIGHT

  // ── Enter edit mode ────────────────────────────────────────────────────────

  const enterEdit = useCallback(() => {
    if (isEditedByOther) return
    // Initialize edit buffer from the current object text on entry.
    // This is a callback (not an effect), so setState here is fine.
    setEditValue(object.text ?? "")
    setIsEditing(true)
  }, [isEditedByOther, object.text])

  // ── Commit or cancel edit ──────────────────────────────────────────────────

  const commitEdit = useCallback(() => {
    setIsEditing(false)
    onTextChange(object.id, editValue)
  }, [object.id, editValue, onTextChange])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    // No need to reset editValue here — it will be re-initialised next time
    // enterEdit is called.
  }, [])

  // ── Position textarea over the Konva Text node ─────────────────────────────

  useEffect(() => {
    if (!isEditing) return

    const scale = viewport.scale
    const areaX = object.x * scale + viewport.x
    const areaY = object.y * scale + viewport.y
    const scaledFontSize = s.fontSize * scale

    const ta = document.createElement("textarea")
    ta.id = `text-edit-${object.id}`
    ta.value = editValue
    ta.style.cssText = `
      position: fixed;
      left: ${areaX + PADDING * scale}px;
      top: ${areaY + PADDING * scale}px;
      width: ${Math.max(w * scale, MIN_WIDTH * scale)}px;
      min-height: ${Math.max(h * scale, MIN_HEIGHT * scale)}px;
      font-size: ${scaledFontSize}px;
      font-family: ${s.fontFamily};
      font-weight: ${s.fontWeight};
      color: ${s.color};
      background: transparent;
      border: 2px solid #6366f1;
      border-radius: 4px;
      outline: none;
      resize: none;
      padding: ${PADDING * scale}px;
      line-height: 1.4;
      overflow: hidden;
      box-sizing: border-box;
      z-index: 9999;
      transform-origin: top left;
    `

    ta.addEventListener("input", (e) => {
      const val = (e.target as HTMLTextAreaElement).value
      setEditValue(val)
      // Auto-resize height
      ta.style.height = "auto"
      ta.style.height = `${ta.scrollHeight}px`
    })

    ta.addEventListener("blur", commitEdit)

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        cancelEdit()
        ta.remove()
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        commitEdit()
        ta.remove()
      }
      // Stop propagation so space doesn't trigger pan
      e.stopPropagation()
    })

    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    textareaRef.current = ta

    return () => {
      ta.removeEventListener("blur", commitEdit)
      ta.remove()
      textareaRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditing && !isEditedByOther}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDblClick={enterEdit}
      onDblTap={enterEdit}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {/* Selection / focus border */}
      {(isSelected || isEditedByOther) && (
        <Rect
          width={w}
          height={h}
          stroke={isEditedByOther ? "#3b82f6" : SELECTION_STROKE}
          strokeWidth={2}
          fill="transparent"
          dash={isEditedByOther ? [6, 4] : undefined}
          cornerRadius={2}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Text node — hidden while editing so the textarea takes over */}
      <Text
        ref={textRef}
        x={PADDING}
        y={PADDING}
        width={w - PADDING * 2}
        text={isEditing ? "" : (object.text ?? "")}
        fontSize={s.fontSize}
        fontFamily={s.fontFamily}
        fontStyle={s.fontWeight === "bold" ? "bold" : "normal"}
        fill={s.color}
        align="left"
        wrap="word"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}
