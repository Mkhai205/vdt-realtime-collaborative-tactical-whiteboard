"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { Box } from "konva/lib/shapes/Transformer"
import { Arrow, Layer, Line, Rect, Stage, Transformer } from "react-konva"
import {
  getVisibleWorldRect,
  screenToWorld,
  viewportZoomStep,
  type CanvasPoint,
} from "@/lib/canvas-utils"
import { cn } from "@/lib/utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { RemoteCursorLayer } from "./remote-cursor-layer"
import { RemoteSelectionLayer } from "./remote-selection-layer"
import { WhiteboardObjectLayer } from "./whiteboard-object-layer"

import {
  minLineLength,
  minLineTransformLength,
  minObjectTransformSize,
  roundCanvasValue,
  buildGridLines,
  buildDragPatch,
  buildTransformPatch,
  applyCommittedPatchToNode,
  createObjectForTool,
} from "./whiteboard-helpers"
import { useCanvasThemeColors } from "./whiteboard-ui-utils"
import { useStagePanning } from "./hooks/use-stage-panning"
import { useThrottledSenders } from "./hooks/use-throttled-senders"

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

type LineDraft = {
  start: CanvasPoint
  end: CanvasPoint
  toolRevision: number
}

type PanDrag = {
  lastPointer: CanvasPoint
}

export function WhiteboardStage() {
  const objectNodesRef = useRef(new Map<string, Konva.Node>())
  const panDragRef = useRef<PanDrag | null>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null)
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
  const sendCursorUpdate = useWhiteboardStore((state) => state.sendCursorUpdate)
  const sendEditingStart = useWhiteboardStore((state) => state.sendEditingStart)
  const sendEditingEnd = useWhiteboardStore((state) => state.sendEditingEnd)

  const colors = useCanvasThemeColors()
  const canEdit = currentUserRole === "OWNER" || currentUserRole === "EDITOR"
  const isTransformToolActive = currentTool === "SELECT"
  const canTransformObjects = canEdit && isTransformToolActive

  const clearPanDrag = useCallback(() => {
    panDragRef.current = null
    setIsPanning(false)
  }, [])

  const {
    activeEditingObjectIdsRef,
    startLocalEditing,
    endLocalEditing,
    endAllLocalEditing,
    queueTransformPreview,
    cancelTransformPreview,
    cancelAllTransformPreviews,
    queueCursorUpdate,
    cancelCursorUpdate,
  } = useThrottledSenders(
    sendCursorUpdate,
    sendTransformPreview,
    sendEditingStart,
    sendEditingEnd,
  )

  const { isSpacePanning, containerRef } = useStagePanning(
    setStageSize,
    clearPanDrag,
    cancelAllTransformPreviews,
    endAllLocalEditing,
  )

  const isPanningModeActive = currentTool === "HAND" || isSpacePanning

  useEffect(() => {
    const activeObjectId = selectedObjectId
    return () => {
      if (activeObjectId) {
        endLocalEditing(activeObjectId)
      }
    }
  }, [endLocalEditing, selectedObjectId])

  useEffect(() => {
    if (currentTool !== "SELECT") {
      endAllLocalEditing()
    }
  }, [currentTool, endAllLocalEditing])

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

    const selectedNode =
      canTransformObjects && selectedObject && selectedObjectId
        ? objectNodesRef.current.get(selectedObjectId)
        : null

    transformer.nodes(selectedNode ? [selectedNode] : [])
    transformer.forceUpdate()
    transformer.getLayer()?.batchDraw()
  }, [canTransformObjects, selectedObject, selectedObjectId])

  useEffect(() => {
    for (const objectId of activeEditingObjectIdsRef.current) {
      if (objectId !== selectedObjectId) {
        endLocalEditing(objectId)
      }
    }
  }, [endLocalEditing, selectedObjectId, activeEditingObjectIdsRef])

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
        endLocalEditing(objectId)
        return
      }

      event.cancelBubble = true
      queueTransformPreview(
        objectId,
        buildDragPatch(currentObject, event.target),
      )
    },
    [canEdit, currentTool, endLocalEditing, queueTransformPreview],
  )

  const handleObjectDragStart = useCallback(
    (objectId: string, event: KonvaEventObject<DragEvent>) => {
      if (!canEdit || currentTool !== "SELECT") {
        return
      }

      const currentObject = useWhiteboardStore.getState().objects[objectId]

      if (!currentObject || currentObject.deletedAt) {
        return
      }

      event.cancelBubble = true
      startLocalEditing(objectId)
    },
    [canEdit, currentTool, startLocalEditing],
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
      updateObjectPatch(objectId, buildDragPatch(currentObject, event.target))
      endLocalEditing(objectId)
      transformerRef.current?.forceUpdate()
    },
    [
      canEdit,
      cancelTransformPreview,
      currentTool,
      endLocalEditing,
      updateObjectPatch,
    ],
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

  const handleTransformStart = useCallback(() => {
    if (!canTransformObjects || !selectedObjectId) {
      return
    }

    const currentObject =
      useWhiteboardStore.getState().objects[selectedObjectId]

    if (!currentObject || currentObject.deletedAt) {
      return
    }

    startLocalEditing(selectedObjectId)
  }, [canTransformObjects, selectedObjectId, startLocalEditing])

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
      endLocalEditing(selectedObjectId)
      return
    }

    const currentObject =
      useWhiteboardStore.getState().objects[selectedObjectId]

    if (!currentObject || currentObject.deletedAt) {
      endLocalEditing(selectedObjectId)
      return
    }

    const patch = buildTransformPatch(currentObject, selectedNode)

    cancelTransformPreview(selectedObjectId)
    applyCommittedPatchToNode(currentObject, selectedNode, patch)
    updateObjectPatch(selectedObjectId, patch)
    endLocalEditing(selectedObjectId)
    transformerRef.current?.forceUpdate()
  }, [
    canTransformObjects,
    cancelTransformPreview,
    endLocalEditing,
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
    const worldPoint = getWorldPointer(event, viewport)

    if (worldPoint) {
      queueCursorUpdate({
        x: roundCanvasValue(worldPoint.x),
        y: roundCanvasValue(worldPoint.y),
      })
    }

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

    if (!worldPoint) {
      return
    }

    setLineDraft((currentDraft) =>
      currentDraft?.toolRevision === toolRevision
        ? { ...currentDraft, end: worldPoint }
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
    cancelCursorUpdate()
    cancelAllTransformPreviews()
    endAllLocalEditing()
    setLineDraft(null)
  }

  function getWorldPointer(
    event: KonvaEventObject<PointerEvent>,
    viewportValue: Parameters<typeof screenToWorld>[1],
  ): CanvasPoint | null {
    const pointer = getStagePointer(event)
    return pointer ? screenToWorld(pointer, viewportValue) : null
  }

  function getStagePointer(
    event: KonvaEventObject<PointerEvent | WheelEvent>,
  ): CanvasPoint | null {
    const pointer = event.target.getStage()?.getPointerPosition()
    return pointer ? { x: pointer.x, y: pointer.y } : null
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full min-h-96 w-full",
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
            onObjectDragStart={handleObjectDragStart}
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
          <RemoteSelectionLayer viewportScale={viewport.scale} />
          <RemoteCursorLayer viewportScale={viewport.scale} />
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
            onTransformStart={handleTransformStart}
            onTransform={handleTransform}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
}
