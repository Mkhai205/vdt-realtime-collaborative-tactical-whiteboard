import type {
  ObjectMutablePatch,
  ObjectType,
  ShapeStyle,
  Tool,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type Konva from "konva"
import { readStoredGuestIdentity } from "../identity"

export type CanvasPoint = {
  x: number
  y: number
}

export type StageSize = {
  width: number
  height: number
}

export type WorldRect = CanvasPoint & {
  width: number
  height: number
}

export type GridLine = {
  id: string
  points: [number, number, number, number]
}

export type LinePoints = [number, number, number, number]

export const smallGridStep = 32
export const majorGridStep = 160
export const rectangleWidth = 160
export const rectangleHeight = 96
export const circleSize = 128
export const textWidth = 220
export const textHeight = 72
export const minLineLength = 8
export const minObjectTransformSize = 16
export const minLineTransformLength = 8
export const canvasValuePrecision = 100

export const defaultRectangleWidth = 160
export const defaultRectangleHeight = 96
export const defaultCircleSize = 128
export const defaultTextWidth = 220
export const defaultTextHeight = 72
export const defaultLinePoints: LinePoints = [0, 0, 160, 0]
export const minimumObjectSize = 16
export const minimumFontSize = 8
export const minimumStrokeWidth = 0

export const demoActorId = "00000000-0000-4000-8000-000000000401"
export const localFallbackActorId = "00000000-0000-4000-8000-000000000402"
export const demoTimestamp = "2026-06-06T00:00:00.000Z"

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
    return [0, 0, rectangleWidth, 0]
  }
  return [
    points[0] ?? 0,
    points[1] ?? 0,
    points[2] ?? rectangleWidth,
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
        width: object.width ?? circleSize,
        height: object.height ?? circleSize,
      }
    case "TEXT":
      return {
        width: object.width ?? textWidth,
        height: object.height ?? textHeight,
      }
    case "RECTANGLE":
      return {
        width: object.width ?? rectangleWidth,
        height: object.height ?? rectangleHeight,
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

export function getLocalActorId(): string {
  return readStoredGuestIdentity()?.id ?? localFallbackActorId
}

export function createLocalObjectRecord(
  roomId: string,
  input: {
    type: ObjectType
    x: number
    y: number
    width?: number
    height?: number
    points?: number[]
    text?: string
    rotation?: number
    style: ShapeStyle
  },
  zIndex: number,
): WhiteboardObject {
  const timestamp = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    roomId,
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    points: input.points,
    text: input.text,
    rotation: input.rotation ?? 0,
    style: input.style,
    zIndex,
    version: 1,
    createdById: getLocalActorId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}

export function createDemoObjects(roomId: string): WhiteboardObject[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000501",
      roomId,
      type: "RECTANGLE",
      x: 9780,
      y: 9820,
      width: 260,
      height: 150,
      rotation: 0,
      style: {
        fill: "rgba(134, 239, 172, 0.18)",
        stroke: "#14532d",
        strokeWidth: 3,
        opacity: 1,
      },
      zIndex: 10,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
      deletedAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000502",
      roomId,
      type: "CIRCLE",
      x: 10130,
      y: 9840,
      width: 180,
      height: 120,
      rotation: 0,
      style: {
        fill: "rgba(243, 220, 164, 0.28)",
        stroke: "#533707",
        strokeWidth: 3,
        opacity: 1,
      },
      zIndex: 20,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
      deletedAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000503",
      roomId,
      type: "LINE",
      x: 10010,
      y: 10100,
      points: [0, 0, 300, -120],
      rotation: 0,
      style: {
        stroke: "#14532d",
        strokeWidth: 5,
        opacity: 1,
        arrowEnd: true,
      },
      zIndex: 30,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
      deletedAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000504",
      roomId,
      type: "TEXT",
      x: 9760,
      y: 10120,
      width: 330,
      height: 84,
      text: "Objective Alpha",
      rotation: 0,
      style: {
        color: "#172018",
        fontSize: 30,
        fontFamily: "sans-serif",
        fontWeight: "bold",
        opacity: 1,
      },
      zIndex: 40,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
      deletedAt: null,
    },
  ]
}

export function createObjectForTool(
  tool: Tool,
  point: CanvasPoint,
  createLocalObject: (input: {
    type: ObjectType
    x: number
    y: number
    width?: number
    height?: number
    points?: number[]
    text?: string
    rotation?: number
    style: ShapeStyle
  }) => WhiteboardObject | null,
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

export function padWorldRect(rect: WorldRect, padding: number): WorldRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function alignToStep(value: number, step: number): number {
  return Math.floor(value / step) * step
}

export function isMajorLine(value: number): boolean {
  return Math.abs(value % majorGridStep) < 0.001
}

export function buildGridLines(visibleWorldRect: WorldRect): {
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
