"use client"
 
import { useEffect, useRef } from "react"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import { resolveStyle } from "./objects/shapeDefaults"
import type { UseObjectMutationsReturn } from "@/features/board/hooks/useObjectMutations"
import type { BoardObjectDto } from "@rctw/shared-contracts"

interface TextEditorOverlayProps {
  mutations: UseObjectMutationsReturn
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

  const editorRef = useRef<HTMLDivElement>(null)

  // Initialize and select all text when component mounts or active object changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerText = object.text ?? ""
      editorRef.current.focus()
      
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [object.id])

  const s = resolveStyle("TEXT", object.style)
  
  // Check if text size should scale automatically in width
  const isAutoWidth = !!object.style.autoWidth

  const screenX = viewport.x + object.x * viewport.scale
  const screenY = viewport.y + object.y * viewport.scale

  const handleCommit = () => {
    setEditingTextId(null)
    if (!editorRef.current) return
    
    const text = editorRef.current.innerText
    if (text.trim() === "") {
      mutations.deleteObject(object.id)
      clearSelection()
    } else {
      const measuredW = isAutoWidth
        ? Math.max(160, Math.ceil(editorRef.current.offsetWidth))
        : (object.width ?? 160)
      const measuredH = Math.max(40, Math.ceil(editorRef.current.offsetHeight))
      
      mutations.updateObject(object.id, {
        text,
        width: measuredW,
        height: measuredH,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleCommit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setEditingTextId(null)
    }
  }

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleCommit}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${screenX}px, ${screenY}px) rotate(${object.rotation}deg) scale(${viewport.scale})`,
        transformOrigin: "top left",
        display: "inline-block",
        width: isAutoWidth ? "max-content" : `${object.width ?? 160}px`,
        minWidth: isAutoWidth ? "160px" : undefined,
        height: "auto",
        minHeight: "40px",
        fontSize: `${s.fontSize ?? 16}px`,
        fontFamily: s.fontFamily ?? "Inter, sans-serif",
        fontWeight: s.fontWeight === "bold" ? "bold" : "normal",
        color: s.color ?? "#1f2937",
        textAlign: s.textAlign ?? "left",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: "4px",
        outline: "none",
        lineHeight: 1.2,
        padding: "2px",
        margin: 0,
        overflow: "hidden",
        whiteSpace: isAutoWidth ? "pre" : "pre-wrap",
        wordBreak: isAutoWidth ? "normal" : "break-word",
        zIndex: 9999,
        cursor: "text",
        userSelect: "text",
      }}
    />
  )
}
