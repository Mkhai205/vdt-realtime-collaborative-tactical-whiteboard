"use client"

import { useCallback, useEffect, useState, type RefCallback } from "react"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { Arrow, Ellipse, Rect, Text, Line, Group, Path, Image as KonvaImage } from "react-konva"
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
        <IconRenderer
          object={object}
          defaultColors={defaultColors}
          draggable={draggable}
          setNodeRef={setNodeRef}
          handlePointerDown={handlePointerDown}
          handleDragStart={handleDragStart}
          handleDragMove={handleDragMove}
          handleDragEnd={handleDragEnd}
        />
      )
  }
}

const ICON_PATHS: Record<string, string> = {
  "default-marker": "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z", // Map Pin
  "flag": "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7", // Flag
  "target": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z", // Target
  "shield": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", // Shield
  "star": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", // Star
  "skull": "M12 2a9 9 0 0 0-9 9c0 2.24.81 4.28 2.16 5.86L6.5 20c.2.6.8.9 1.4.9h8.2c.6 0 1.2-.3 1.4-.9l1.34-3.14A8.96 8.96 0 0 0 21 11a9 9 0 0 0-9-9zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z", // Skull
}

type IconRendererProps = {
  object: WhiteboardObject
  defaultColors: ShapeDefaultColors
  draggable: boolean
  setNodeRef: RefCallback<Konva.Node>
  handlePointerDown: (event: KonvaEventObject<PointerEvent>) => void
  handleDragStart: (event: KonvaEventObject<DragEvent>) => void
  handleDragMove: (event: KonvaEventObject<DragEvent>) => void
  handleDragEnd: (event: KonvaEventObject<DragEvent>) => void
}

function IconRenderer({
  object,
  defaultColors,
  draggable,
  setNodeRef,
  handlePointerDown,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
}: IconRendererProps) {
  const { iconKey, assetUrl, label } = object.style

  const [prevAssetUrl, setPrevAssetUrl] = useState<string | undefined>(assetUrl)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "failed">(
    assetUrl ? "loading" : "failed"
  )

  if (assetUrl !== prevAssetUrl) {
    setPrevAssetUrl(assetUrl)
    setImage(null)
    setImageStatus(assetUrl ? "loading" : "failed")
  }

  const width = object.width ?? defaultRectangleWidth
  const height = object.height ?? defaultRectangleHeight

  useEffect(() => {
    if (!assetUrl) {
      return
    }

    const img = new window.Image()
    img.src = assetUrl

    let active = true

    const handleLoad = () => {
      if (active) {
        setImage(img)
        setImageStatus("loaded")
      }
    }
    const handleError = () => {
      if (active) {
        setImage(null)
        setImageStatus("failed")
      }
    }

    img.addEventListener("load", handleLoad)
    img.addEventListener("error", handleError)

    return () => {
      active = false
      img.removeEventListener("load", handleLoad)
      img.removeEventListener("error", handleError)
    }
  }, [assetUrl])

  let graphicElement = null

  if (assetUrl && imageStatus === "loaded" && image) {
    graphicElement = (
      <KonvaImage
        image={image}
        width={width}
        height={height}
        opacity={object.style.opacity ?? 1}
      />
    )
  } else {
    const pathData = (iconKey && ICON_PATHS[iconKey]) || ICON_PATHS["default-marker"]
    const scaleX = width / 24
    const scaleY = height / 24

    graphicElement = (
      <Path
        data={pathData}
        fill={object.style.fill ?? defaultColors.primary}
        stroke={object.style.stroke ?? defaultColors.primary}
        strokeWidth={object.style.strokeWidth ?? 1}
        scaleX={scaleX}
        scaleY={scaleY}
        opacity={object.style.opacity ?? 1}
      />
    )
  }

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
        width={width}
        height={height}
        fill="transparent"
        stroke={object.style.stroke ?? "transparent"}
        strokeWidth={object.style.strokeWidth ?? defaultStrokeWidth}
        opacity={object.style.opacity ?? 1}
      />
      {graphicElement}
      {label && (
        <Text
          x={0}
          y={height + 4}
          width={width}
          align="center"
          text={label}
          fill={defaultColors.foreground}
          fontSize={14}
          fontFamily="sans-serif"
        />
      )}
    </Group>
  )
}

function normalizeLinePoints(points: WhiteboardObject["points"]): number[] {
  if (!points || points.length < 4) {
    return defaultLinePoints
  }

  return points.slice(0, 4)
}


