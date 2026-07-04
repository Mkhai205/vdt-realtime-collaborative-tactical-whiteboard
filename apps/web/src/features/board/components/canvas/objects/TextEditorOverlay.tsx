"use client"

import { useEffect, useRef } from "react"
import { useUIStore } from "@/stores/ui.store"
import type { ShapeStyle } from "@rctw/shared-contracts"

interface TextEditorOverlayProps {
  objectId: string
  x: number
  y: number
  w: number
  h: number
  style: ShapeStyle
  editValue: string
  setEditValue: (val: string) => void
  commitEdit: () => void
  cancelEdit: () => void
}

const PADDING = 6
const MIN_WIDTH = 120
const MIN_HEIGHT = 40

export function TextEditorOverlay({
  objectId,
  x,
  y,
  w,
  h,
  style,
  editValue,
  setEditValue,
  commitEdit,
  cancelEdit,
}: TextEditorOverlayProps) {
  const viewport = useUIStore((s) => s.viewport)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Keep textarea position, scale, and dimensions synchronized with viewport changes
  useEffect(() => {
    const scale = viewport.scale
    const areaX = x * scale + viewport.x
    const areaY = y * scale + viewport.y
    const scaledFontSize = (style.fontSize ?? 16) * scale

    const ta = textareaRef.current
    if (!ta) return

    ta.style.left = `${areaX + PADDING * scale}px`
    ta.style.top = `${areaY + PADDING * scale}px`
    ta.style.width = `${Math.max((w - PADDING * 2) * scale, MIN_WIDTH * scale)}px`
    ta.style.minHeight = `${Math.max((h - PADDING * 2) * scale, MIN_HEIGHT * scale)}px`
    ta.style.fontSize = `${scaledFontSize}px`
  }, [viewport, x, y, w, h, style.fontSize])

  // Automatically grow height as the user types new lines
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return

    ta.style.height = "auto"
    ta.style.height = `${ta.scrollHeight}px`
  }, [editValue])

  return (
    <textarea
      ref={(el) => {
        textareaRef.current = el
        if (el) {
          el.focus()
          el.select()
        }
      }}
      id={`text-edit-${objectId}`}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          cancelEdit()
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          commitEdit()
        }
        // Stop propagation so spacebar doesn't trigger stage panning
        e.stopPropagation()
      }}
      style={{
        position: "fixed",
        background: "transparent",
        border: "none",
        outline: "none",
        resize: "none",
        padding: 0,
        margin: 0,
        lineHeight: 1.4,
        overflow: "hidden",
        boxSizing: "border-box",
        zIndex: 9999,
        transformOrigin: "top left",
        fontFamily: style.fontFamily ?? "sans-serif",
        fontWeight: style.fontWeight ?? "normal",
        color: style.color ?? "#1f2937",
        caretColor: style.color ?? "#1f2937",
      }}
    />
  )
}
