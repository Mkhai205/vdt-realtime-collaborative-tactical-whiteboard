"use client"

import { useEffect, useRef, useState } from "react"
import { Stage } from "react-konva"
import { useUIStore } from "@/stores/ui.store"
import { CanvasBackground } from "./CanvasBackground"
import { ObjectsLayer } from "./ObjectsLayer"
import { DrawingPreview } from "./DrawingPreview"
import { SelectionLayer } from "./SelectionLayer"
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
  const { viewport, activeTool } = useUIStore()

  // Realtime Sync & mutations hooks
  const cursorEmit = useCursorEmit(boardId)

  const zoom = useZoom({ stageRef })
  const pan = usePan({ stageRef })
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
        pan.setSpaceDown(true)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        pan.setSpaceDown(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [pan])

  // ── Cursor style based on active tool ─────────────────────────────────────

  const cursorStyle = getCursorStyle(activeTool)

  // ── Prevent native scroll/zoom while canvas is active ─────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const preventNative = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("wheel", preventNative, { passive: false })

    return () => el.removeEventListener("wheel", preventNative)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (stageSize.width === 0) return null

  return (
    <div
      ref={containerRef}
      id="canvas-stage-container"
      style={{
        position: "absolute",
        inset: 0,
        cursor: cursorStyle,
        overflow: "hidden",
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
        {/* Layer 0 — Background grid (listening=false for perf) */}
        <CanvasBackground
          stageWidth={stageSize.width}
          stageHeight={stageSize.height}
        />

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
