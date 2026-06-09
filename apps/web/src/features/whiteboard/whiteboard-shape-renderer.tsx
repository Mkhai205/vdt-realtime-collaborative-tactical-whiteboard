"use client"

import { useCallback, type RefCallback } from "react"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { Arrow, Ellipse, Rect, Text } from "react-konva"

const defaultShapeWidth = 160
const defaultShapeHeight = 96
const defaultLinePoints = [0, 0, 160, 0]
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
          width={object.width ?? defaultShapeWidth}
          height={object.height ?? defaultShapeHeight}
          rotation={object.rotation}
          fill={object.style.fill ?? transparentFill(defaultColors.primary)}
          stroke={object.style.stroke ?? defaultColors.primary}
          strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
          opacity={object.style.opacity ?? 1}
          draggable={draggable}
          onPointerDown={handlePointerDown}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
    case "CIRCLE": {
      const width = object.width ?? defaultShapeWidth
      const height = object.height ?? defaultShapeWidth

      return (
        <Ellipse
          ref={setNodeRef}
          x={object.x + width / 2}
          y={object.y + height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          rotation={object.rotation}
          fill={object.style.fill ?? transparentFill(defaultColors.accent)}
          stroke={object.style.stroke ?? defaultColors.accent}
          strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
          opacity={object.style.opacity ?? 1}
          draggable={draggable}
          onPointerDown={handlePointerDown}
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
          width={object.width ?? 220}
          height={object.height ?? defaultShapeHeight}
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
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      )
  }
}

function normalizeLinePoints(points: WhiteboardObject["points"]): number[] {
  if (!points || points.length < 4) {
    return defaultLinePoints
  }

  return points.slice(0, 4)
}

function transparentFill(color: string): string {
  if (!color.startsWith("#")) {
    return color
  }

  const hex = color.slice(1)
  const normalizedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex

  if (normalizedHex.length !== 6) {
    return color
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return color
  }

  return `rgba(${red}, ${green}, ${blue}, 0.14)`
}
