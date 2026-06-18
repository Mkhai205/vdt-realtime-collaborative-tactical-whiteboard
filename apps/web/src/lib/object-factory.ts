import type {
  ObjectType,
  ShapeStyle,
  WhiteboardObject,
  Tool,
} from "@rctw/shared-contracts"
import {
  demoActorId,
  demoTimestamp,
  defaultRectangleWidth,
  defaultRectangleHeight,
  defaultCircleSize,
  defaultTextWidth,
  defaultTextHeight,
} from "@/lib/canvas-constants"
import type { CanvasPoint } from "@/lib/canvas-utils"

export function createLocalObjectRecord(
  boardId: string,
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
  createdById: string,
): WhiteboardObject {
  const timestamp = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    boardId,
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
    createdById,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}

export function createDemoObjects(boardId: string): WhiteboardObject[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000501",
      boardId,
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
      boardId,
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
      boardId,
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
      boardId,
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
): void {
  switch (tool) {
    case "RECTANGLE":
      createLocalObject({
        type: "RECTANGLE",
        x: point.x - defaultRectangleWidth / 2,
        y: point.y - defaultRectangleHeight / 2,
        width: defaultRectangleWidth,
        height: defaultRectangleHeight,
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
        x: point.x - defaultCircleSize / 2,
        y: point.y - defaultCircleSize / 2,
        width: defaultCircleSize,
        height: defaultCircleSize,
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
        width: defaultTextWidth,
        height: defaultTextHeight,
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
