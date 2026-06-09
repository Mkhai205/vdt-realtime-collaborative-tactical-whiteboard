"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  ObjectMutablePatch,
  ObjectTransformPreviewPatch,
  Tool,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { Box } from "konva/lib/shapes/Transformer"
import { Arrow, Layer, Line, Rect, Stage, Transformer } from "react-konva"
import {
  getVisibleWorldRect,
  screenToWorld,
  viewportZoomStep,
  type CanvasPoint,
  type WorldRect,
} from "@/lib/canvas-utils"
import { cn } from "@/lib/utils"
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
const minObjectTransformSize = 16
const minLineTransformLength = 8
const canvasValuePrecision = 100
const transformPreviewThrottleMs = 50

const transformerAnchors = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]

type GridLine = {
  id: string
  points: [number, number, number, number]
}

type LinePoints = [number, number, number, number]

type LineDraft = {
  start: CanvasPoint
  end: CanvasPoint
  toolRevision: number
}

type PanDrag = {
  lastPointer: CanvasPoint
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
  const panDragRef = useRef<PanDrag | null>(null)
  const transformPreviewTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  )
  const transformPreviewLastSentAtRef = useRef(new Map<string, number>())
  const transformPreviewPendingRef = useRef(
    new Map<string, ObjectTransformPreviewPatch>(),
  )
  const transformerRef = useRef<Konva.Transformer>(null)
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null)
  const [isSpacePanning, setIsSpacePanning] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const currentTool = useWhiteboardStore((state) => state.currentTool)
  const toolRevision = useWhiteboardStore((state) => state.toolRevision)
  const selectedObjectId = useWhiteboardStore((state) => state.selectedObjectId)
  const selectedObject = useWhiteboardStore((state) =>
    state.selectedObjectId ? state.objects[state.selectedObjectId] : null,
  )
  const currentUserRole = useWhiteboardStore((state) => state.currentUser?.role)
  const viewport = useWhiteboardStore((state) => state.viewport)
  const stageSize = useWhiteboardStore((state) => state.stageSize)
  const createLocalObject = useWhiteboardStore(
    (state) => state.createLocalObject,
  )
  const selectObject = useWhiteboardStore((state) => state.selectObject)
  const setStageSize = useWhiteboardStore((state) => state.setStageSize)
  const panViewportBy = useWhiteboardStore((state) => state.panViewportBy)
  const zoomViewportBy = useWhiteboardStore((state) => state.zoomViewportBy)
  const updateObjectPatch = useWhiteboardStore(
    (state) => state.updateObjectPatch,
  )
  const sendTransformPreview = useWhiteboardStore(
    (state) => state.sendTransformPreview,
  )
  const colors = useCanvasThemeColors()
  const canEdit = currentUserRole === "OWNER" || currentUserRole === "EDITOR"
  const isTransformToolActive = currentTool === "SELECT"
  const isPanningModeActive = currentTool === "HAND" || isSpacePanning
  const canTransformObjects = canEdit && isTransformToolActive

  const clearPanDrag = useCallback(() => {
    panDragRef.current = null
    setIsPanning(false)
  }, [])

  const cancelTransformPreview = useCallback((objectId: string) => {
    const timeout = transformPreviewTimersRef.current.get(objectId)

    if (timeout) {
      clearTimeout(timeout)
      transformPreviewTimersRef.current.delete(objectId)
    }

    transformPreviewPendingRef.current.delete(objectId)
  }, [])

  const cancelAllTransformPreviews = useCallback(() => {
    for (const timeout of transformPreviewTimersRef.current.values()) {
      clearTimeout(timeout)
    }

    transformPreviewTimersRef.current.clear()
    transformPreviewPendingRef.current.clear()
  }, [])

  const queueTransformPreview = useCallback(
    (objectId: string, preview: ObjectTransformPreviewPatch) => {
      const now = Date.now()
      const lastSentAt =
        transformPreviewLastSentAtRef.current.get(objectId) ?? 0
      const elapsed = now - lastSentAt

      if (elapsed >= transformPreviewThrottleMs) {
        cancelTransformPreview(objectId)
        transformPreviewLastSentAtRef.current.set(objectId, now)
        sendTransformPreview(objectId, preview)
        return
      }

      transformPreviewPendingRef.current.set(objectId, preview)

      if (transformPreviewTimersRef.current.has(objectId)) {
        return
      }

      const timeout = setTimeout(() => {
        transformPreviewTimersRef.current.delete(objectId)

        const pendingPreview =
          transformPreviewPendingRef.current.get(objectId)

        if (!pendingPreview) {
          return
        }

        transformPreviewPendingRef.current.delete(objectId)
        transformPreviewLastSentAtRef.current.set(objectId, Date.now())
        sendTransformPreview(objectId, pendingPreview)
      }, transformPreviewThrottleMs - elapsed)

      transformPreviewTimersRef.current.set(objectId, timeout)
    },
    [cancelTransformPreview, sendTransformPreview],
  )

  useEffect(() => {
    return () => {
      cancelAllTransformPreviews()
    }
  }, [cancelAllTransformPreviews])

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        isEditableEventTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      setIsSpacePanning(true)
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return
      }

      if (!isEditableEventTarget(event.target)) {
        event.preventDefault()
      }

      setIsSpacePanning(false)
      clearPanDrag()
    }

    function handleWindowBlur() {
      setIsSpacePanning(false)
      clearPanDrag()
      cancelAllTransformPreviews()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleWindowBlur)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleWindowBlur)
    }
  }, [cancelAllTransformPreviews, clearPanDrag])

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

    const selectedNode = canTransformObjects && selectedObject && selectedObjectId
      ? objectNodesRef.current.get(selectedObjectId)
      : null

    transformer.nodes(selectedNode ? [selectedNode] : [])
    transformer.forceUpdate()
    transformer.getLayer()?.batchDraw()
  }, [canTransformObjects, selectedObject, selectedObjectId])

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
      if (isPanningModeActive || currentTool !== "SELECT") {
        return
      }

      event.cancelBubble = true
      selectObject(objectId)
    },
    [currentTool, isPanningModeActive, selectObject],
  )

  const handleObjectDragMove = useCallback(
    (objectId: string, event: KonvaEventObject<DragEvent>) => {
      if (!canEdit || currentTool !== "SELECT") {
        return
      }

      const currentObject = useWhiteboardStore.getState().objects[objectId]

      if (!currentObject || currentObject.deletedAt) {
        return
      }

      event.cancelBubble = true
      queueTransformPreview(
        objectId,
        buildDragPatch(currentObject, event.target),
      )
    },
    [canEdit, currentTool, queueTransformPreview],
  )

  const handleObjectDragEnd = useCallback(
    (objectId: string, event: KonvaEventObject<DragEvent>) => {
      if (!canEdit || currentTool !== "SELECT") {
        return
      }

      const currentObject = useWhiteboardStore.getState().objects[objectId]

      if (!currentObject || currentObject.deletedAt) {
        return
      }

      event.cancelBubble = true
      cancelTransformPreview(objectId)
      updateObjectPatch(
        objectId,
        buildDragPatch(currentObject, event.target),
      )
      transformerRef.current?.forceUpdate()
    },
    [canEdit, cancelTransformPreview, currentTool, updateObjectPatch],
  )

  const handleTransformerBoundBox = useCallback(
    (oldBox: Box, newBox: Box): Box => {
      const currentObject = selectedObjectId
        ? useWhiteboardStore.getState().objects[selectedObjectId]
        : null

      if (currentObject?.type === "LINE") {
        return Math.hypot(newBox.width, newBox.height) < minLineTransformLength
          ? oldBox
          : newBox
      }

      if (
        Math.abs(newBox.width) < minObjectTransformSize ||
        Math.abs(newBox.height) < minObjectTransformSize
      ) {
        return oldBox
      }

      return newBox
    },
    [selectedObjectId],
  )

  const handleTransform = useCallback(() => {
    if (!canTransformObjects || !selectedObjectId) {
      return
    }

    const selectedNode = objectNodesRef.current.get(selectedObjectId)

    if (!selectedNode) {
      return
    }

    const currentObject =
      useWhiteboardStore.getState().objects[selectedObjectId]

    if (!currentObject || currentObject.deletedAt) {
      return
    }

    queueTransformPreview(
      selectedObjectId,
      buildTransformPatch(currentObject, selectedNode),
    )
  }, [canTransformObjects, queueTransformPreview, selectedObjectId])

  const handleTransformEnd = useCallback(() => {
    if (!canTransformObjects || !selectedObjectId) {
      return
    }

    const selectedNode = objectNodesRef.current.get(selectedObjectId)

    if (!selectedNode) {
      return
    }

    const currentObject =
      useWhiteboardStore.getState().objects[selectedObjectId]

    if (!currentObject || currentObject.deletedAt) {
      return
    }

    const patch = buildTransformPatch(currentObject, selectedNode)

    cancelTransformPreview(selectedObjectId)
    applyCommittedPatchToNode(currentObject, selectedNode, patch)
    updateObjectPatch(selectedObjectId, patch)
    transformerRef.current?.forceUpdate()
  }, [
    canTransformObjects,
    cancelTransformPreview,
    selectedObjectId,
    updateObjectPatch,
  ])

  function handleWheel(event: KonvaEventObject<WheelEvent>) {
    const pointer = getStagePointer(event)

    if (!pointer) {
      return
    }

    event.evt.preventDefault()
    zoomViewportBy(
      event.evt.deltaY < 0 ? viewportZoomStep : 1 / viewportZoomStep,
      pointer,
    )
  }

  function handlePointerDown(event: KonvaEventObject<PointerEvent>) {
    if (isPanningModeActive) {
      const pointer = getStagePointer(event)

      if (!pointer) {
        return
      }

      event.evt.preventDefault()
      event.cancelBubble = true
      panDragRef.current = { lastPointer: pointer }
      setIsPanning(true)
      setLineDraft(null)
      return
    }

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

    if (!canEdit) {
      return
    }

    if (currentTool === "LINE") {
      setLineDraft({ start: point, end: point, toolRevision })
      return
    }

    createObjectForTool(currentTool, point, createLocalObject)
  }

  function handlePointerMove(event: KonvaEventObject<PointerEvent>) {
    if (panDragRef.current) {
      const pointer = getStagePointer(event)

      if (!pointer) {
        return
      }

      event.evt.preventDefault()
      panViewportBy({
        x: pointer.x - panDragRef.current.lastPointer.x,
        y: pointer.y - panDragRef.current.lastPointer.y,
      })
      panDragRef.current = { lastPointer: pointer }
      return
    }

    if (isPanningModeActive) {
      return
    }

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

  function handlePointerUp(event: KonvaEventObject<PointerEvent>) {
    if (panDragRef.current) {
      event.evt.preventDefault()
      clearPanDrag()
      return
    }

    if (isPanningModeActive) {
      setLineDraft(null)
      return
    }

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

  function handlePointerCancel() {
    clearPanDrag()
    cancelAllTransformPreviews()
    setLineDraft(null)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full min-h-[24rem] w-full",
        isPanningModeActive
          ? isPanning
            ? "cursor-grabbing"
            : "cursor-grab"
          : null,
      )}
    >
      <Stage
        width={Math.max(1, stageSize.width)}
        height={Math.max(1, stageSize.height)}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
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
            draggable={canTransformObjects && !isPanningModeActive}
            onObjectPointerDown={handleObjectPointerDown}
            onObjectDragMove={handleObjectDragMove}
            onObjectDragEnd={handleObjectDragEnd}
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
            visible={canTransformObjects && Boolean(selectedObjectId)}
            listening={canTransformObjects && !isPanningModeActive}
            resizeEnabled
            rotateEnabled
            enabledAnchors={transformerAnchors}
            keepRatio={false}
            flipEnabled={false}
            boundBoxFunc={handleTransformerBoundBox}
            useSingleNodeRotation
            anchorSize={10 / viewport.scale}
            anchorFill={colors.background}
            anchorStroke={colors.primary}
            anchorStrokeWidth={1.5 / viewport.scale}
            anchorCornerRadius={2 / viewport.scale}
            borderStroke={colors.primary}
            borderStrokeWidth={1 / viewport.scale}
            rotateAnchorOffset={36 / viewport.scale}
            onTransform={handleTransform}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
}

function buildDragPatch(
  object: WhiteboardObject,
  node: Konva.Node,
): ObjectMutablePatch {
  if (object.type === "CIRCLE") {
    const { width, height } = getStoredObjectSize(object)

    return {
      x: roundCanvasValue(node.x() - width / 2),
      y: roundCanvasValue(node.y() - height / 2),
    }
  }

  return {
    x: roundCanvasValue(node.x()),
    y: roundCanvasValue(node.y()),
  }
}

function buildTransformPatch(
  object: WhiteboardObject,
  node: Konva.Node,
): ObjectMutablePatch {
  const rotation = normalizeRotationDegrees(node.rotation())

  switch (object.type) {
    case "RECTANGLE": {
      const rectNode = node as Konva.Rect

      return {
        x: roundCanvasValue(rectNode.x()),
        y: roundCanvasValue(rectNode.y()),
        width: toStoredDimension(rectNode.width() * rectNode.scaleX()),
        height: toStoredDimension(rectNode.height() * rectNode.scaleY()),
        rotation,
      }
    }
    case "CIRCLE": {
      const ellipseNode = node as Konva.Ellipse
      const width = toStoredDimension(
        ellipseNode.radiusX() * 2 * ellipseNode.scaleX(),
      )
      const height = toStoredDimension(
        ellipseNode.radiusY() * 2 * ellipseNode.scaleY(),
      )

      return {
        x: roundCanvasValue(ellipseNode.x() - width / 2),
        y: roundCanvasValue(ellipseNode.y() - height / 2),
        width,
        height,
        rotation,
      }
    }
    case "LINE": {
      const arrowNode = node as Konva.Arrow
      const points = getLinePoints(arrowNode.points())
      const scaleX = arrowNode.scaleX()
      const scaleY = arrowNode.scaleY()

      return {
        x: roundCanvasValue(arrowNode.x()),
        y: roundCanvasValue(arrowNode.y()),
        points: [
          roundCanvasValue(points[0] * scaleX),
          roundCanvasValue(points[1] * scaleY),
          roundCanvasValue(points[2] * scaleX),
          roundCanvasValue(points[3] * scaleY),
        ],
        rotation,
      }
    }
    case "TEXT": {
      const textNode = node as Konva.Text

      return {
        x: roundCanvasValue(textNode.x()),
        y: roundCanvasValue(textNode.y()),
        width: toStoredDimension(textNode.width() * textNode.scaleX()),
        height: toStoredDimension(textNode.height() * textNode.scaleY()),
        rotation,
      }
    }
  }
}

function applyCommittedPatchToNode(
  object: WhiteboardObject,
  node: Konva.Node,
  patch: ObjectMutablePatch,
) {
  node.scaleX(1)
  node.scaleY(1)

  if (typeof patch.rotation === "number") {
    node.rotation(patch.rotation)
  }

  switch (object.type) {
    case "RECTANGLE": {
      const rectNode = node as Konva.Rect

      rectNode.x(patch.x ?? rectNode.x())
      rectNode.y(patch.y ?? rectNode.y())
      rectNode.width(patch.width ?? rectNode.width())
      rectNode.height(patch.height ?? rectNode.height())
      return
    }
    case "CIRCLE": {
      const ellipseNode = node as Konva.Ellipse
      const { width, height } = getPatchedObjectSize(object, patch)

      ellipseNode.x((patch.x ?? object.x) + width / 2)
      ellipseNode.y((patch.y ?? object.y) + height / 2)
      ellipseNode.radiusX(width / 2)
      ellipseNode.radiusY(height / 2)
      return
    }
    case "LINE": {
      const arrowNode = node as Konva.Arrow

      arrowNode.x(patch.x ?? arrowNode.x())
      arrowNode.y(patch.y ?? arrowNode.y())

      if (patch.points) {
        arrowNode.points(patch.points)
      }

      return
    }
    case "TEXT": {
      const textNode = node as Konva.Text

      textNode.x(patch.x ?? textNode.x())
      textNode.y(patch.y ?? textNode.y())
      textNode.width(patch.width ?? textNode.width())
      textNode.height(patch.height ?? textNode.height())
      return
    }
  }
}

function getPatchedObjectSize(
  object: WhiteboardObject,
  patch: ObjectMutablePatch,
): { width: number; height: number } {
  const currentSize = getStoredObjectSize(object)

  return {
    width: patch.width ?? currentSize.width,
    height: patch.height ?? currentSize.height,
  }
}

function getStoredObjectSize(object: WhiteboardObject): {
  width: number
  height: number
} {
  switch (object.type) {
    case "CIRCLE":
      return {
        width: object.width ?? circleSize,
        height: object.height ?? circleSize,
      }
    case "TEXT":
      return {
        width: object.width ?? textWidth,
        height: object.height ?? textHeight,
      }
    case "RECTANGLE":
    case "LINE":
      return {
        width: object.width ?? rectangleWidth,
        height: object.height ?? rectangleHeight,
      }
  }
}

function getLinePoints(points: number[] | null | undefined): LinePoints {
  if (!points || points.length < 4) {
    return [0, 0, rectangleWidth, 0]
  }

  return [
    points[0] ?? 0,
    points[1] ?? 0,
    points[2] ?? rectangleWidth,
    points[3] ?? 0,
  ]
}

function toStoredDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return minObjectTransformSize
  }

  return Math.max(minObjectTransformSize, roundCanvasValue(Math.abs(value)))
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

function roundCanvasValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * canvasValuePrecision) / canvasValuePrecision
}

function normalizeRotationDegrees(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0
  }

  return roundCanvasValue(((rotation % 360) + 360) % 360)
}

function getWorldPointer(
  event: KonvaEventObject<PointerEvent>,
  viewport: Parameters<typeof screenToWorld>[1],
): CanvasPoint | null {
  const pointer = getStagePointer(event)

  return pointer ? screenToWorld(pointer, viewport) : null
}

function getStagePointer(
  event: KonvaEventObject<PointerEvent | WheelEvent>,
): CanvasPoint | null {
  const pointer = event.target.getStage()?.getPointerPosition()

  return pointer ? { x: pointer.x, y: pointer.y } : null
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

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()

  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  const role = target.getAttribute("role")

  return role === "textbox" || Boolean(target.closest("[contenteditable=true]"))
}
