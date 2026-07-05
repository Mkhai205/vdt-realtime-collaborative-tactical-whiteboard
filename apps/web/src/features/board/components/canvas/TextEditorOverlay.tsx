"use client"

import { useEffect, useRef, useState } from "react"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import { resolveStyle } from "./objects/shapeDefaults"
import type { UseObjectMutationsReturn } from "@/features/board/hooks/useObjectMutations"
import type { BoardObjectDto, ShapeStyle } from "@rctw/shared-contracts"

interface TextEditorOverlayProps {
  mutations: UseObjectMutationsReturn
}

function measureText(text: string, style: ShapeStyle, autoWidth: boolean, fixedWidth?: number) {
  if (typeof document === "undefined") {
    return { width: fixedWidth ?? 160, height: 40 }
  }

  const div = document.createElement("div")
  div.style.position = "absolute"
  div.style.visibility = "hidden"
  div.style.top = "-9999px"
  div.style.left = "-9999px"
  div.style.fontSize = `${style.fontSize ?? 16}px`
  div.style.fontFamily = style.fontFamily ?? "Inter, sans-serif"
  div.style.fontWeight = style.fontWeight === "bold" ? "bold" : "normal"
  div.style.lineHeight = "1.2"
  div.style.padding = "2px"
  div.style.border = "1px solid"
  div.style.margin = "0"
  div.style.whiteSpace = autoWidth ? "pre" : "pre-wrap"
  div.style.wordBreak = autoWidth ? "normal" : "break-word"
  
  if (!autoWidth && fixedWidth) {
    div.style.width = `${fixedWidth}px`
  }

  // Ensure trailing newline or empty string is measured with height
  div.textContent = text === "" ? " " : text.endsWith("\n") ? text + " " : text
  document.body.appendChild(div)
  
  const rect = div.getBoundingClientRect()
  const width = autoWidth 
    ? Math.max(160, Math.ceil(rect.width + 16)) 
    : (fixedWidth ?? 160)
  const height = Math.max(40, Math.ceil(rect.height + 6))
  
  document.body.removeChild(div)
  return { width, height }
}

export function TextEditorOverlay({ mutations }: TextEditorOverlayProps) {
  const editingTextId = useUIStore((s) => s.editingTextId)
  const object = useBoardStore((s) => editingTextId ? s.objects.get(editingTextId) : null)

  if (!editingTextId || !object) return null

  return (
    <TextEditorOverlayInner
      object={object}
      mutations={mutations}
    />
  )
}

interface TextEditorOverlayInnerProps {
  object: BoardObjectDto
  mutations: UseObjectMutationsReturn
}

function TextEditorOverlayInner({ object, mutations }: TextEditorOverlayInnerProps) {
  const setEditingTextId = useUIStore((s) => s.setEditingTextId)
  const viewport = useUIStore((s) => s.viewport)
  const clearSelection = useUIStore((s) => s.clearSelection)

  const [prevObjectId, setPrevObjectId] = useState(object.id)
  const [editVal, setEditVal] = useState(object.text ?? "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When the object changes, reset state unless it is a local-to-real ID upgrade
  if (object.id !== prevObjectId) {
    setPrevObjectId(object.id)
    const isUpgrade = prevObjectId.startsWith("local-") && !object.id.startsWith("local-")
    if (!isUpgrade) {
      setEditVal(object.text ?? "")
    }
  }

  // Focus and select all text when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [])

  const s = resolveStyle("TEXT", object.style)
  
  // Check if text size should scale automatically in width
  const isAutoWidth = !!object.style.autoWidth

  const { width: currentW, height: currentH } = measureText(
    editVal,
    s,
    isAutoWidth,
    object.width ?? undefined
  )

  const screenX = viewport.x + object.x * viewport.scale
  const screenY = viewport.y + object.y * viewport.scale

  const handleCommit = () => {
    setEditingTextId(null)
    const text = editVal
    if (text.trim() === "") {
      mutations.deleteObject(object.id)
      clearSelection()
    } else {
      mutations.updateObject(object.id, {
        text,
        width: currentW,
        height: currentH,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleCommit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setEditingTextId(null)
    }
  }

  return (
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
        width: `${currentW}px`,
        height: `${currentH}px`,
        fontSize: `${s.fontSize ?? 16}px`,
        fontFamily: s.fontFamily ?? "Inter, sans-serif",
        fontWeight: s.fontWeight === "bold" ? "bold" : "normal",
        color: s.color ?? "#1f2937",
        background: "rgba(255, 255, 255, 0.95)",
        border: "1px solid transparent",
        borderRadius: "4px",
        outline: "none",
        resize: "none",
        lineHeight: 1.2,
        padding: "2px",
        margin: 0,
        overflow: "hidden",
        whiteSpace: isAutoWidth ? "pre" : "pre-wrap",
        wordBreak: isAutoWidth ? "normal" : "break-word",
        zIndex: 9999,
      }}
    />
  )
}
