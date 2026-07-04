import { useEffect, useRef, useState, useCallback } from "react"
import { Text, Group, Rect } from "react-konva"
import type Konva from "konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { useUIStore } from "@/stores/ui.store"
import { EditingBadge } from "./EditingBadge"

import { useBoardStore } from "@/stores/board.store"
import { getSocket } from "@/lib/socket/socket"
import { toast } from "sonner"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TextObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
  /** Called when user finishes editing to persist the new text */
  onTextChange: (id: string, text: string, width?: number, height?: number) => void
  setObjectEditingState?: (objectId: string, status: "STARTED" | "ENDED") => void
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
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTextChange,
  setObjectEditingState,
}: TextObjectProps) {
  const s = resolveStyle("TEXT", object.style)
  const { viewport } = useUIStore()
  const textRef = useRef<Konva.Text>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  // editValue tracks in-progress keystrokes — only meaningful while isEditing.
  // We do NOT sync this from object.text; instead it is initialized fresh in enterEdit.
  const [editValue, setEditValue] = useState("")

  const boardId = useBoardStore((s) => s.boardId)

  const w = object.width ?? MIN_WIDTH
  const h = object.height ?? MIN_HEIGHT

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser?.avatarColor || "#3b82f6"
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  // ── Enter edit mode ────────────────────────────────────────────────────────

  const enterEdit = useCallback(() => {
    if (isEditedByOther || isViewer) return
    // Initialize edit buffer from the current object text on entry.
    // This is a callback (not an effect), so setState here is fine.
    setEditValue(object.text ?? "")
    setIsEditing(true)
    useUIStore.getState().setEditingTextId(object.id)
    if (setObjectEditingState) {
      setObjectEditingState(object.id, "STARTED")
    }
  }, [isEditedByOther, isViewer, object.text, object.id, setObjectEditingState])

  // Auto-enter edit mode for newly created empty text objects
  const autoEditTriggeredRef = useRef(false)
  useEffect(() => {
    if (
      isSelected &&
      !isEditing &&
      (object.text === "" || object.text === "Text") &&
      !isEditedByOther &&
      !isViewer &&
      !autoEditTriggeredRef.current
    ) {
      autoEditTriggeredRef.current = true
      enterEdit()
    }
  }, [isSelected, isEditing, object.text, isEditedByOther, isViewer, enterEdit])

  // Ephemeral live typing preview emission
  useEffect(() => {
    if (!isEditing || !boardId) return

    const socket = getSocket()
    if (!socket.connected) return

    const timeoutId = setTimeout(() => {
      socket.emit("text:editing", {
        boardId,
        objectId: object.id,
        text: editValue,
      })
    }, 150) // Debounce 150ms

    return () => clearTimeout(timeoutId)
  }, [editValue, isEditing, boardId, object.id])

  // Handle case where object is locked by another user while we are editing
  useEffect(() => {
    if (isEditing && isEditedByOther) {
      setIsEditing(false)
      useUIStore.getState().setEditingTextId(null)
      if (textareaRef.current) {
        textareaRef.current.remove()
      }
    }
  }, [isEditing, isEditedByOther])

  // Handle lock failure events
  useEffect(() => {
    const handleLockFailed = () => {
      setIsEditing(false)
      useUIStore.getState().setEditingTextId(null)
      if (textareaRef.current) {
        textareaRef.current.remove()
      }
    }
    window.addEventListener(`object-lock-failed-${object.id}`, handleLockFailed)
    return () => {
      window.removeEventListener(`object-lock-failed-${object.id}`, handleLockFailed)
    }
  }, [object.id])

  // Handle external Enter trigger to edit text
  useEffect(() => {
    const handleTriggerEdit = () => {
      enterEdit()
    }
    window.addEventListener(`trigger-text-edit-${object.id}`, handleTriggerEdit)
    return () => {
      window.removeEventListener(`trigger-text-edit-${object.id}`, handleTriggerEdit)
    }
  }, [object.id, enterEdit])


  const isUnmountingRef = useRef(false)
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true
    }
  }, [])

  // ── Commit or cancel edit ──────────────────────────────────────────────────

  const commitEdit = useCallback(() => {
    if (isUnmountingRef.current) return
    setIsEditing(false)
    useUIStore.getState().setEditingTextId(null)
    const textNode = textRef.current
    let finalWidth = w
    let finalHeight = h
    if (textNode) {
      // Temporarily set the text to measure the size accurately
      textNode.text(editValue)
      const actualWidth = textNode.getTextWidth() + PADDING * 2
      finalWidth = Math.max(Math.min(w, actualWidth), MIN_WIDTH)
      finalHeight = Math.max(textNode.height() + PADDING * 2, MIN_HEIGHT)
    }
    onTextChange(object.id, editValue, finalWidth, finalHeight)
    if (setObjectEditingState) {
      setObjectEditingState(object.id, "ENDED")
    }
  }, [object.id, editValue, onTextChange, setObjectEditingState, w, h])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    useUIStore.getState().setEditingTextId(null)
    if (setObjectEditingState) {
      setObjectEditingState(object.id, "ENDED")
    }
  }, [object.id, setObjectEditingState])

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
      width: ${Math.max((w - PADDING * 2) * scale, MIN_WIDTH * scale)}px;
      min-height: ${Math.max((h - PADDING * 2) * scale, MIN_HEIGHT * scale)}px;
      font-size: ${scaledFontSize}px;
      font-family: ${s.fontFamily};
      font-weight: ${s.fontWeight};
      color: ${s.color};
      background: transparent;
      border: none;
      outline: none;
      resize: none;
      padding: 0;
      margin: 0;
      line-height: 1.4;
      overflow: hidden;
      box-sizing: border-box;
      z-index: 9999;
      transform-origin: top left;
      caret-color: ${s.color};
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
      width={w}
      height={h}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditing && !isEditedByOther && !isViewer && isSelectTool}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDblClick={enterEdit}
      onDblTap={enterEdit}
      onDragStart={() => onDragStart(object.id)}
      onDragMove={(e) => onDragMove(object.id, e.target.x(), e.target.y(), e)}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {/* Invisible hit box covering the full width and height */}
      <Rect
        width={w}
        height={h}
        fill="rgba(0,0,0,0)"
        listening={true}
      />

      {/* Selection / focus border */}
      {(isSelected || isEditedByOther) && (
        <Rect
          width={w}
          height={h}
          stroke={isEditedByOther ? borderStroke : SELECTION_STROKE}
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

      {/* Editing-by-other badge */}
      {isEditedByOther && (
        <EditingBadge
          x={Math.max(0, w - badgeWidth)}
          y={-20}
          name={editingUser.name}
          color={borderStroke}
        />
      )}
    </Group>
  )
}
