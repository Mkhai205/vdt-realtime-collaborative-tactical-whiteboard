"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Tool } from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { Arrow, Layer, Line, Rect, Stage, Transformer } from "react-konva"
import {
  getVisibleWorldRect,
  screenToWorld,
  type CanvasPoint,
  type WorldRect,
} from "@/lib/canvas-utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { WhiteboardObjectLayer } from "./whiteboard-object-layer"

const smallGridStep = 32
const majorGridStep = 160
const rectangleWidth = 160
const rectangleHeight = 96
const circleSize = 128
const textWidth = 220
const textHeight = 72
const minLineLength = 8

type GridLine = {
  id: string
  points: [number, number, number, number]
}

type LineDraft = {
  start: CanvasPoint
  end: CanvasPoint
  toolRevision: number
}

type CanvasThemeColors = {
  background: string
  minorGrid: string
  majorGrid: string
  foreground: string
  primary: string
  accent: string
}

const fallbackCanvasColors: CanvasThemeColors = {
  background: "#f7f7f1",
  minorGrid: "rgba(212, 218, 205, 0.58)",
  majorGrid: "rgba(63, 125, 81, 0.5)",
  foreground: "#172018",
  primary: "#14532d",
  accent: "#533707",
}

export function WhiteboardStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const objectNodesRef = useRef(new Map<string, Konva.Node>())
  const transformerRef = useRef<Konva.Transformer>(null)
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null)
  const currentTool = useWhiteboardStore((state) => state.currentTool)
  const toolRevision = useWhiteboardStore((state) => state.toolRevision)
  const selectedObjectId = useWhiteboardStore((state) => state.selectedObjectId)
  const viewport = useWhiteboardStore((state) => state.viewport)
  const stageSize = useWhiteboardStore((state) => state.stageSize)
  const createLocalObject = useWhiteboardStore(
    (state) => state.createLocalObject,
  )
  const selectObject = useWhiteboardStore((state) => state.selectObject)
  const setStageSize = useWhiteboardStore((state) => state.setStageSize)
  const updateObjectPatch = useWhiteboardStore(
    (state) => state.updateObjectPatch,
  )
  const colors = useCanvasThemeColors()

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const containerElement = container

    function updateStageSize() {
      const rect = containerElement.getBoundingClientRect()

      setStageSize({
        width: rect.width,
        height: rect.height,
      })
    }

    updateStageSize()

    const observer = new ResizeObserver(updateStageSize)
    observer.observe(containerElement)

    return () => {
      observer.disconnect()
    }
  }, [setStageSize])

  const visibleWorldRect = useMemo(
    () => getVisibleWorldRect(viewport, stageSize),
    [stageSize, viewport],
  )
  const gridLines = useMemo(
    () => buildGridLines(visibleWorldRect),
    [visibleWorldRect],
  )

  const activeLineDraft =
    currentTool === "LINE" && lineDraft?.toolRevision === toolRevision
      ? lineDraft
      : null

  useEffect(() => {
    const transformer = transformerRef.current

    if (!transformer) {
      return
    }

    const selectedNode = selectedObjectId
      ? objectNodesRef.current.get(selectedObjectId)
      : null

    transformer.nodes(selectedNode ? [selectedNode] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedObjectId])

  const registerObjectNode = useCallback(
    (objectId: string, node: Konva.Node | null) => {
      if (node) {
        objectNodesRef.current.set(objectId, node)
        return
      }

      objectNodesRef.current.delete(objectId)
    },
    [],
  )

  const handleObjectPointerDown = useCallback(
    (objectId: string, event: KonvaEventObject<PointerEvent>) => {
      if (currentTool !== "SELECT") {
        return
      }

      event.cancelBubble = true
      selectObject(objectId)
    },
    [currentTool, selectObject],
  )

  const handleTransformEnd = useCallback(() => {
    if (!selectedObjectId) {
      return
    }

    const selectedNode = objectNodesRef.current.get(selectedObjectId)

    if (!selectedNode) {
      return
    }

    const rotation = normalizeRotationDegrees(selectedNode.rotation())
    const currentObject =
      useWhiteboardStore.getState().objects[selectedObjectId]

    if (
      !currentObject ||
      rotation === normalizeRotationDegrees(currentObject.rotation)
    ) {
      return
    }

    selectedNode.rotation(rotation)
    updateObjectPatch(selectedObjectId, { rotation })
  }, [selectedObjectId, updateObjectPatch])

  function handlePointerDown(event: KonvaEventObject<PointerEvent>) {
    if (currentTool === "SELECT") {
      if (event.target === event.target.getStage()) {
        selectObject(null)
      }

      return
    }

    const point = getWorldPointer(event, viewport)

    if (!point) {
      return
    }

    if (currentTool === "LINE") {
      setLineDraft({ start: point, end: point, toolRevision })
      return
    }

    createObjectForTool(currentTool, point, createLocalObject)
  }

  function handlePointerMove(event: KonvaEventObject<PointerEvent>) {
    if (!activeLineDraft) {
      return
    }

    const point = getWorldPointer(event, viewport)

    if (!point) {
      return
    }

    setLineDraft((currentDraft) =>
      currentDraft?.toolRevision === toolRevision
        ? { ...currentDraft, end: point }
        : currentDraft,
    )
  }

  function handlePointerUp() {
    if (!activeLineDraft) {
      setLineDraft(null)
      return
    }

    const dx = activeLineDraft.end.x - activeLineDraft.start.x
    const dy = activeLineDraft.end.y - activeLineDraft.start.y

    if (Math.hypot(dx, dy) >= minLineLength) {
      createLocalObject({
        type: "LINE",
        x: activeLineDraft.start.x,
        y: activeLineDraft.start.y,
        points: [0, 0, dx, dy],
        style: {
          stroke: colors.primary,
          strokeWidth: 5,
          opacity: 1,
          arrowEnd: true,
        },
      })
    }

    setLineDraft(null)
  }

  return (
    <div ref={containerRef} className="h-full min-h-[24rem] w-full">
      <Stage
        width={Math.max(1, stageSize.width)}
        height={Math.max(1, stageSize.height)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <Layer
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          <Rect
            x={visibleWorldRect.x}
            y={visibleWorldRect.y}
            width={visibleWorldRect.width}
            height={visibleWorldRect.height}
            fill={colors.background}
            listening={false}
          />
          {gridLines.minor.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={colors.minorGrid}
              strokeWidth={1 / viewport.scale}
              listening={false}
            />
          ))}
          {gridLines.major.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={colors.majorGrid}
              strokeWidth={1.5 / viewport.scale}
              listening={false}
            />
          ))}
          <WhiteboardObjectLayer
            defaultColors={{
              foreground: colors.foreground,
              primary: colors.primary,
              accent: colors.accent,
            }}
            onObjectPointerDown={handleObjectPointerDown}
            registerObjectNode={registerObjectNode}
          />
          {activeLineDraft ? (
            <Arrow
              x={activeLineDraft.start.x}
              y={activeLineDraft.start.y}
              points={[
                0,
                0,
                activeLineDraft.end.x - activeLineDraft.start.x,
                activeLineDraft.end.y - activeLineDraft.start.y,
              ]}
              stroke={colors.primary}
              fill={colors.primary}
              strokeWidth={4}
              opacity={0.72}
              pointerAtEnding
              dash={[12, 8]}
              listening={false}
            />
          ) : null}
          <Transformer
            ref={transformerRef}
            resizeEnabled={false}
            rotateEnabled
            enabledAnchors={[]}
            useSingleNodeRotation
            anchorSize={10 / viewport.scale}
            anchorFill={colors.background}
            anchorStroke={colors.primary}
            anchorStrokeWidth={1.5 / viewport.scale}
            anchorCornerRadius={2 / viewport.scale}
            borderStroke={colors.primary}
            borderStrokeWidth={1 / viewport.scale}
            rotateAnchorOffset={36 / viewport.scale}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
}

function buildGridLines(visibleWorldRect: WorldRect): {
  minor: GridLine[]
  major: GridLine[]
} {
  const paddedRect = padWorldRect(visibleWorldRect, majorGridStep)
  const minor: GridLine[] = []
  const major: GridLine[] = []

  for (
    let x = alignToStep(paddedRect.x, smallGridStep);
    x <= paddedRect.x + paddedRect.width;
    x += smallGridStep
  ) {
    const target = isMajorLine(x) ? major : minor

    target.push({
      id: `v-${x}`,
      points: [x, paddedRect.y, x, paddedRect.y + paddedRect.height],
    })
  }

  for (
    let y = alignToStep(paddedRect.y, smallGridStep);
    y <= paddedRect.y + paddedRect.height;
    y += smallGridStep
  ) {
    const target = isMajorLine(y) ? major : minor

    target.push({
      id: `h-${y}`,
      points: [paddedRect.x, y, paddedRect.x + paddedRect.width, y],
    })
  }

  return { minor, major }
}

function padWorldRect(rect: WorldRect, padding: number): WorldRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function alignToStep(value: number, step: number): number {
  return Math.floor(value / step) * step
}

function isMajorLine(value: number): boolean {
  return Math.abs(value % majorGridStep) < 0.001
}

function normalizeRotationDegrees(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0
  }

  return Math.round((((rotation % 360) + 360) % 360) * 100) / 100
}

function getWorldPointer(
  event: KonvaEventObject<PointerEvent>,
  viewport: Parameters<typeof screenToWorld>[1],
): CanvasPoint | null {
  const pointer = event.target.getStage()?.getPointerPosition()

  return pointer ? screenToWorld(pointer, viewport) : null
}

function createObjectForTool(
  tool: Tool,
  point: CanvasPoint,
  createLocalObject: ReturnType<
    typeof useWhiteboardStore.getState
  >["createLocalObject"],
) {
  switch (tool) {
    case "RECTANGLE":
      createLocalObject({
        type: "RECTANGLE",
        x: point.x - rectangleWidth / 2,
        y: point.y - rectangleHeight / 2,
        width: rectangleWidth,
        height: rectangleHeight,
        style: {
          fill: "rgba(134, 239, 172, 0.18)",
          stroke: "#14532d",
          strokeWidth: 3,
          opacity: 1,
        },
      })
      return
    case "CIRCLE":
      createLocalObject({
        type: "CIRCLE",
        x: point.x - circleSize / 2,
        y: point.y - circleSize / 2,
        width: circleSize,
        height: circleSize,
        style: {
          fill: "rgba(243, 220, 164, 0.28)",
          stroke: "#533707",
          strokeWidth: 3,
          opacity: 1,
        },
      })
      return
    case "TEXT":
      createLocalObject({
        type: "TEXT",
        x: point.x,
        y: point.y,
        width: textWidth,
        height: textHeight,
        text: "Text note",
        style: {
          color: "#172018",
          fontSize: 24,
          fontFamily: "sans-serif",
          fontWeight: "bold",
          opacity: 1,
        },
      })
      return
    case "SELECT":
    case "HAND":
    case "LINE":
      return
  }
}

function useCanvasThemeColors(): CanvasThemeColors {
  const [colors, setColors] = useState<CanvasThemeColors>(fallbackCanvasColors)

  useEffect(() => {
    function updateColors() {
      const styles = getComputedStyle(document.documentElement)
      const background = styles.getPropertyValue("--background").trim()
      const foreground = styles.getPropertyValue("--foreground").trim()
      const primary = styles.getPropertyValue("--primary").trim()
      const accent = styles.getPropertyValue("--accent-foreground").trim()
      const border = styles.getPropertyValue("--border").trim()
      const ring = styles.getPropertyValue("--ring").trim()

      setColors({
        background: background || fallbackCanvasColors.background,
        minorGrid: withAlpha(border, 0.58) || fallbackCanvasColors.minorGrid,
        majorGrid: withAlpha(ring, 0.5) || fallbackCanvasColors.majorGrid,
        foreground: foreground || fallbackCanvasColors.foreground,
        primary: primary || fallbackCanvasColors.primary,
        accent: accent || fallbackCanvasColors.accent,
      })
    }

    updateColors()

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", updateColors)

    return () => {
      media.removeEventListener("change", updateColors)
    }
  }, [])

  return colors
}

function withAlpha(color: string, alpha: number): string {
  const trimmedColor = color.trim()

  if (!trimmedColor.startsWith("#")) {
    return trimmedColor
  }

  const hex = trimmedColor.slice(1)
  const normalizedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex

  if (normalizedHex.length !== 6) {
    return trimmedColor
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return trimmedColor
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
