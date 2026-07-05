"use client"

import { useEffect, useRef, useState } from "react"
import { Stage } from "react-konva"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import { useTheme } from "next-themes"
import { ObjectsLayer } from "./ObjectsLayer"
import { DrawingPreview } from "./DrawingPreview"
import { SelectionLayer } from "./SelectionLayer"
import { TextEditorOverlay } from "./TextEditorOverlay"
import { useViewport } from "./useViewport"
import { useZoom } from "./useZoom"
import { usePan } from "./usePan"
import { useCanvasEvents } from "./useCanvasEvents"
import { useShapeCreation } from "@/features/board/hooks/useShapeCreation"
import { useLassoSelect } from "@/features/board/hooks/useLassoSelect"
import { useTransform } from "@/features/board/hooks/useTransform"
import { useKeyboardActions } from "@/features/board/hooks/useKeyboardActions"

import { type UseObjectMutationsReturn } from "@/features/board/hooks/useObjectMutations"
import { useCursorEmit } from "@/features/board/hooks/useCursorEmit"
import { boardApi } from "@/features/board/api/board.api"
import { DEFAULT_STYLES } from "./objects/shapeDefaults"


// ─── Props ─────────────────────────────────────────────────────────────────────

interface CanvasStageProps {
  boardId: string
  mutations: UseObjectMutationsReturn
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * The root Konva Stage component.
 *
 * Responsibilities:
 *  - Full-screen stage that reacts to window resize
 *  - Wires viewport (pan/zoom) state from UIStore into the Stage
 *  - Routes wheel, mouse-down/move/up, dblClick to dedicated hooks
 *  - Manages spacebar keydown/keyup for pan-in-any-tool mode
 *  - Renders the layer structure:
 *      [0] CanvasBackground  (dot grid, listening=false)
 *      [1] Objects           (board objects)
 *      [2] Selection         (Transformer + lasso rect)
 *      [3] UI                (drawing preview)
 */
export function CanvasStage({ boardId, mutations }: CanvasStageProps) {
  // ── Stage dimensions ──────────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateSize = () => {
      setStageSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // ── Viewport / hooks ──────────────────────────────────────────────────────

  const viewportHook = useViewport()
  const { stageRef } = viewportHook

  const viewport = useUIStore((s) => s.viewport)
  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const dotColor = isDark ? "#374151" : "#d1d5db"

  // Realtime Sync & mutations hooks
  const cursorEmit = useCursorEmit(boardId)

  const zoom = useZoom({ stageRef })
  const pan = usePan({ stageRef })
  const { setSpaceDown } = pan
  const shapeCreation = useShapeCreation(stageRef, mutations.createObject)
  const lassoSelect = useLassoSelect(stageRef)
  const transform = useTransform(mutations.updateObject)

  const events = useCanvasEvents({
    stageRef,
    pan,
    zoom,
    shapeCreation,
    lassoSelect,
    cursorEmit,
  })

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useKeyboardActions(mutations)

  // ── Spacebar → pan override ───────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault()
        setSpaceDown(true)
        useUIStore.getState().setIsSpacePressed(true)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false)
        useUIStore.getState().setIsSpacePressed(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      useUIStore.getState().setIsSpacePressed(false)
    }
  }, [setSpaceDown])

  // ── Viewport change broadcast ─────────────────────────────────────────────

  useEffect(() => {
    const stage = stageRef.current
    const isFollowing = useUIStore.getState().followingUserId !== null
    if (stage && !isFollowing) {
      cursorEmit.onCursorMove(stage)
    }
  }, [viewport.x, viewport.y, viewport.scale, cursorEmit, stageRef])

  // ── Cursor style based on active tool ─────────────────────────────────────

  const cursorStyle =
    activeTool === "HAND" || isSpacePressed
      ? pan.isPanning
        ? "grabbing"
        : "grab"
      : getCursorStyle(activeTool)

  // ── Prevent native scroll/zoom while canvas is active ─────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const preventNative = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("wheel", preventNative, { passive: false })

    return () => el.removeEventListener("wheel", preventNative)
  }, [])

  // ── Clipboard paste handler ─────────────────────────────────────────────

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return

      const items = e.clipboardData?.items
      if (!items || !boardId) return

      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }

      if (imageFiles.length === 0) return
      e.preventDefault()

      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.scale
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.scale

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]!
        try {
          const result = await boardApi.uploadImage(boardId, file)

          const img = new window.Image()
          img.src = result.url
          img.onload = () => {
            let w = img.naturalWidth || 200
            let h = img.naturalHeight || 200

            const maxDim = 400
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = (maxDim / w) * h
                w = maxDim
              } else {
                w = (maxDim / h) * w
                h = maxDim
              }
            }

            const offsetX = i * 20
            const offsetY = i * 20
            const x = centerX - w / 2 + offsetX
            const y = centerY - h / 2 + offsetY

            const preferredStyle = useUIStore.getState().toolStyles["IMAGE"] || DEFAULT_STYLES["IMAGE"]
            const style = {
              ...preferredStyle,
              assetUrl: result.url,
            }

            mutations.createObject({
              type: "IMAGE",
              x,
              y,
              width: w,
              height: h,
              rotation: 0,
              style,
              zIndex: useBoardStore.getState().objects.size,
            })
          }
        } catch (err) {
          console.error("Failed to upload pasted image:", err)
        }
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [boardId, viewport.x, viewport.y, viewport.scale, mutations])

  // ── Drag & Drop handler ──────────────────────────────────────────────────

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter((f) => f.type.startsWith("image/"))
    if (imageFiles.length === 0 || !boardId) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    const worldX = (screenX - viewport.x) / viewport.scale
    const worldY = (screenY - viewport.y) / viewport.scale

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]!
      try {
        const result = await boardApi.uploadImage(boardId, file)

        const img = new window.Image()
        img.src = result.url
        img.onload = () => {
          let w = img.naturalWidth || 200
          let h = img.naturalHeight || 200

          const maxDim = 400
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = (maxDim / w) * h
              w = maxDim
            } else {
              w = (maxDim / h) * w
              h = maxDim
            }
          }

          const offsetX = i * 20
          const offsetY = i * 20
          const x = worldX - w / 2 + offsetX
          const y = worldY - h / 2 + offsetY

          const preferredStyle = useUIStore.getState().toolStyles["IMAGE"] || DEFAULT_STYLES["IMAGE"]
          const style = {
            ...preferredStyle,
            assetUrl: result.url,
          }

          mutations.createObject({
            type: "IMAGE",
            x,
            y,
            width: w,
            height: h,
            rotation: 0,
            style,
            zIndex: useBoardStore.getState().objects.size,
          })
        }
      } catch (err) {
        console.error("Failed to upload dropped image:", err)
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (stageSize.width === 0) return null

  // CSS grid background styles matching the Konva-based dots
  const gridStyle = viewport.scale >= 0.22
    ? {
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1.5px)`,
        backgroundSize: `${20 * viewport.scale}px ${20 * viewport.scale}px`,
        backgroundPosition: `${viewport.x - 10 * viewport.scale}px ${viewport.y - 10 * viewport.scale}px`,
      }
    : {}

  return (
    <div
      ref={containerRef}
      id="canvas-stage-container"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        position: "absolute",
        inset: 0,
        cursor: cursorStyle,
        overflow: "hidden",
        ...gridStyle,
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onMouseDown={events.onMouseDown}
        onMouseMove={events.onMouseMove}
        onMouseUp={events.onMouseUp}
        onWheel={events.onWheel}
        onDblClick={events.onDblClick}
        // Prevent right-click context menu on the stage
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {/* Layer 1 — Board objects (sorted by zIndex) */}
        <ObjectsLayer mutations={mutations} />

        {/* Layer 2 — Selection handles (Transformer + lasso) */}
        <SelectionLayer
          stageRef={stageRef}
          lassoSelect={lassoSelect}
          transform={transform}
        />

        {/* Layer 3 — Drawing preview */}
        <DrawingPreview />
      </Stage>

      {/* Text Editor Overlay */}
      <TextEditorOverlay mutations={mutations} />
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getCursorStyle(tool: string): string {
  switch (tool) {
    case "HAND":
      return "grab"
    case "SELECT":
      return "default"
    case "RECTANGLE":
    case "CIRCLE":
    case "LINE":
    case "PATH":
    case "ICON":
      return "crosshair"
    case "TEXT":
      return "text"

    default:
      return "default"
  }
}
