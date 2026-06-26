"use client"

import { useCallback, type RefCallback } from "react"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { Arrow, Ellipse, Rect, Text, Line, Group } from "react-konva"
import {
  defaultRectangleWidth,
  defaultRectangleHeight,
  defaultLinePoints,
  defaultTextWidth,
} from "@/lib/canvas-constants"
import { withAlpha } from "@/lib/color-utils"

const defaultStrokeWidth = 2
const defaultFontSize = 24

export type ShapeDefaultColors = {
  foreground: string
  primary: string
  accent: string
}

type WhiteboardShapeRendererProps = {
  object: WhiteboardObject
  defaultColors: ShapeDefaultColors
  draggable?: boolean
  onObjectPointerDown?: (
    objectId: string,
    event: KonvaEventObject<PointerEvent>,
  ) => void
  onObjectDragEnd?: (
    objectId: string,
    event: KonvaEventObject<DragEvent>,
  ) => void
  onObjectDragStart?: (
    objectId: string,
    event: KonvaEventObject<DragEvent>,
  ) => void
  onObjectDragMove?: (
    objectId: string,
    event: KonvaEventObject<DragEvent>,
  ) => void
  registerObjectNode?: (objectId: string, node: Konva.Node | null) => void
}

export function WhiteboardShapeRenderer({
  object,
  defaultColors,
  draggable = false,
  onObjectPointerDown,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectDragMove,
  registerObjectNode,
}: WhiteboardShapeRendererProps) {
  const setNodeRef = useCallback<RefCallback<Konva.Node>>(
    (node) => {
      registerObjectNode?.(object.id, node)
    },
    [object.id, registerObjectNode],
  )
  const handlePointerDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      onObjectPointerDown?.(object.id, event)
    },
    [object.id, onObjectPointerDown],
  )
  const handleDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      onObjectDragEnd?.(object.id, event)
    },
    [object.id, onObjectDragEnd],
  )
  const handleDragStart = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      onObjectDragStart?.(object.id, event)
    },
    [object.id, onObjectDragStart],
  )
  const handleDragMove = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      onObjectDragMove?.(object.id, event)
    },
    [object.id, onObjectDragMove],
  )

  switch (object.type) {
    case "RECTANGLE":
      return (
        <Rect
          ref={setNodeRef}
          x={object.x}
          y={object.y}
          width={object.width ?? defaultRectangleWidth}
          height={object.height ?? defaultRectangleHeight}
          rotation={object.rotation}
          fill={object.style.fill ?? withAlpha(defaultColors.primary, 0.14)}
          stroke={object.style.stroke ?? defaultColors.primary}
          strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
          opacity={object.style.opacity ?? 1}
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
    case "CIRCLE": {
      const width = object.width ?? defaultRectangleWidth
      const height = object.height ?? defaultRectangleWidth

      return (
        <Ellipse
          ref={setNodeRef}
          x={object.x + width / 2}
          y={object.y + height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          rotation={object.rotation}
          fill={object.style.fill ?? withAlpha(defaultColors.accent, 0.14)}
          stroke={object.style.stroke ?? defaultColors.accent}
          strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
          opacity={object.style.opacity ?? 1}
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
    }
    case "LINE":
      return (
        <Arrow
          ref={setNodeRef}
          x={object.x}
          y={object.y}
          points={normalizeLinePoints(object.points)}
          rotation={object.rotation}
          stroke={object.style.stroke ?? defaultColors.primary}
          fill={object.style.stroke ?? defaultColors.primary}
          strokeWidth={object.style.strokeWidth ?? 4}
          opacity={object.style.opacity ?? 1}
          pointerAtBeginning={object.style.arrowStart ?? false}
          pointerAtEnding={object.style.arrowEnd ?? true}
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
    case "TEXT":
      return (
        <Text
          ref={setNodeRef}
          x={object.x}
          y={object.y}
          width={object.width ?? defaultTextWidth}
          height={object.height ?? defaultRectangleHeight}
          rotation={object.rotation}
          text={object.text ?? ""}
          fill={
            object.style.color ?? object.style.fill ?? defaultColors.foreground
          }
          fontSize={object.style.fontSize ?? defaultFontSize}
          fontFamily={object.style.fontFamily ?? "sans-serif"}
          fontStyle={object.style.fontWeight ?? "normal"}
          opacity={object.style.opacity ?? 1}
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
    case "PATH":
      return (
        <Line
          ref={setNodeRef}
          x={object.x}
          y={object.y}
          points={object.points ?? []}
          rotation={object.rotation}
          stroke={object.style.stroke ?? defaultColors.primary}
          strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
          opacity={object.style.opacity ?? 1}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
    case "ICON":
      return (
        <Group
          ref={setNodeRef}
          x={object.x}
          y={object.y}
          rotation={object.rotation}
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <Rect
            x={0}
            y={0}
            width={object.width ?? defaultRectangleWidth}
            height={object.height ?? defaultRectangleHeight}
            fill={object.style.fill ?? withAlpha(defaultColors.primary, 0.14)}
            stroke={object.style.stroke ?? defaultColors.primary}
            strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
            opacity={object.style.opacity ?? 1}
          />
          {object.style.label && (
            <Text
              x={0}
              y={(object.height ?? defaultRectangleHeight) + 4}
              text={object.style.label}
              fill={defaultColors.foreground}
              fontSize={14}
              fontFamily="sans-serif"
            />
          )}
        </Group>
      )
  }
}

function normalizeLinePoints(points: WhiteboardObject["points"]): number[] {
  if (!points || points.length < 4) {
    return defaultLinePoints
  }

  return points.slice(0, 4)
}


