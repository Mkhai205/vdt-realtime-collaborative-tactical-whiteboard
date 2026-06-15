import type {
  ObjectMutablePatch,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type Konva from "konva"
import type { CanvasPoint, StageSize } from "@/lib/canvas-utils"
import type { WorldRect } from "@/lib/canvas-utils"
import {
  type LinePoints,
  smallGridStep,
  majorGridStep,
  defaultRectangleWidth,
  defaultRectangleHeight,
  defaultCircleSize,
  defaultTextWidth,
  defaultTextHeight,
  defaultLinePoints,
  minimumObjectSize,
  minimumFontSize,
  minimumStrokeWidth,
  minLineLength,
  minObjectTransformSize,
  minLineTransformLength,
  canvasValuePrecision,
  demoActorId,
  localFallbackActorId,
  demoTimestamp,
} from "@/lib/canvas-constants"

// Re-export for backward compatibility
export type { CanvasPoint, StageSize, WorldRect, LinePoints }
export {
  smallGridStep,
  majorGridStep,
  defaultRectangleWidth,
  defaultRectangleHeight,
  defaultCircleSize,
  defaultTextWidth,
  defaultTextHeight,
  defaultLinePoints,
  minimumObjectSize,
  minimumFontSize,
  minimumStrokeWidth,
  minLineLength,
  minObjectTransformSize,
  minLineTransformLength,
  canvasValuePrecision,
  demoActorId,
  localFallbackActorId,
  demoTimestamp,
}



export function roundCanvasValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.round(value * canvasValuePrecision) / canvasValuePrecision
}

export function normalizeRotationDegrees(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0
  }
  return roundCanvasValue(((rotation % 360) + 360) % 360)
}

export function getLinePoints(points: number[] | null | undefined): LinePoints {
  if (!points || points.length < 4) {
    return [0, 0, defaultRectangleWidth, 0]
  }
  return [
    points[0] ?? 0,
    points[1] ?? 0,
    points[2] ?? defaultRectangleWidth,
    points[3] ?? 0,
  ]
}

export function getObjectDimensions(object: WhiteboardObject): {
  width: number
  height: number
} {
  switch (object.type) {
    case "CIRCLE":
      return {
        width: object.width ?? defaultCircleSize,
        height: object.height ?? defaultCircleSize,
      }
    case "TEXT":
      return {
        width: object.width ?? defaultTextWidth,
        height: object.height ?? defaultTextHeight,
      }
    case "RECTANGLE":
      return {
        width: object.width ?? defaultRectangleWidth,
        height: object.height ?? defaultRectangleHeight,
      }
    case "LINE": {
      const points = getLinePoints(object.points)
      return {
        width: Math.abs(points[2] - points[0]),
        height: Math.abs(points[3] - points[1]),
      }
    }
  }
}

export function getStoredObjectSize(object: WhiteboardObject): {
  width: number
  height: number
} {
  switch (object.type) {
    case "CIRCLE":
      return {
        width: object.width ?? defaultCircleSize,
        height: object.height ?? defaultCircleSize,
      }
    case "TEXT":
      return {
        width: object.width ?? defaultTextWidth,
        height: object.height ?? defaultTextHeight,
      }
    case "RECTANGLE":
    case "LINE":
      return {
        width: object.width ?? defaultRectangleWidth,
        height: object.height ?? defaultRectangleHeight,
      }
  }
}

export function getPatchedObjectSize(
  object: WhiteboardObject,
  patch: ObjectMutablePatch,
): { width: number; height: number } {
  const currentSize = getStoredObjectSize(object)
  return {
    width: patch.width ?? currentSize.width,
    height: patch.height ?? currentSize.height,
  }
}

export function getObjectSizeSummary(object: WhiteboardObject): string {
  if (object.type === "LINE") {
    const points = getLinePoints(object.points)
    const length = Math.hypot(points[2] - points[0], points[3] - points[1])
    return `${formatNumber(length)} px`
  }
  const dimensions = getObjectDimensions(object)
  return `${formatNumber(dimensions.width)} x ${formatNumber(dimensions.height)}`
}

export function toStoredDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return minObjectTransformSize
  }
  return Math.max(minObjectTransformSize, roundCanvasValue(Math.abs(value)))
}

export function clamp(value: number, min?: number, max?: number): number {
  let nextValue = value
  if (typeof min === "number") {
    nextValue = Math.max(min, nextValue)
  }
  if (typeof max === "number") {
    nextValue = Math.min(max, nextValue)
  }
  return nextValue
}

export function clampMinimum(value: number, min: number): number {
  return Math.max(min, roundCanvasValue(value))
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0"
  }
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/, "")
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "-"
  }
  return value.replace("T", " ").replace(".000Z", "Z")
}

export function buildDragPatch(
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

export function buildTransformPatch(
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

export function applyCommittedPatchToNode(
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

export function applyMutablePatchToObject(
  object: WhiteboardObject,
  patch: ObjectMutablePatch,
): WhiteboardObject {
  return {
    ...object,
    ...patch,
    style: patch.style
      ? {
          ...object.style,
          ...patch.style,
        }
      : object.style,
  }
}


