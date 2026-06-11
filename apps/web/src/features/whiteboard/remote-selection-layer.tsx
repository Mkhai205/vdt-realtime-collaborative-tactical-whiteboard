"use client"

import { useMemo } from "react"
import type { OnlineUser, WhiteboardObject } from "@rctw/shared-contracts"
import { Ellipse, Group, Rect, Text } from "react-konva"
import {
  type RemoteEditingState,
  useWhiteboardStore,
} from "@/stores/whiteboard-store"

const fallbackSelectionColor = "#14532d"
const labelHeight = 24
const labelPaddingX = 7
const maxLabelWidth = 176
const minLabelWidth = 56
const defaultShapeWidth = 160
const defaultShapeHeight = 96
const defaultCircleSize = 128
const defaultTextWidth = 220
const defaultTextHeight = 72
const defaultLinePoints = [0, 0, 160, 0] as const

type RemoteSelectionIndicator = {
  object: WhiteboardObject
  users: OnlineUser[]
}

type RemoteEditingIndicator = {
  object: WhiteboardObject
  editors: RemoteEditingState[]
}

type LineBounds = {
  x: number
  y: number
  width: number
  height: number
}

export function RemoteSelectionLayer({
  viewportScale,
}: {
  viewportScale: number
}) {
  const objects = useWhiteboardStore((state) => state.objects)
  const onlineUsers = useWhiteboardStore((state) => state.onlineUsers)
  const remoteEditors = useWhiteboardStore((state) => state.remoteEditors)
  const currentUserId = useWhiteboardStore((state) => state.currentUser?.id)
  const safeViewportScale = Math.max(viewportScale, 0.001)
  const screenScale = 1 / safeViewportScale
  const strokeWidth = 2 / safeViewportScale
  const padding = 6 / safeViewportScale
  const cornerRadius = 4 / safeViewportScale
  const dash = [10 / safeViewportScale, 6 / safeViewportScale]
  const indicators = useMemo(
    () => buildRemoteSelectionIndicators(objects, onlineUsers, currentUserId),
    [currentUserId, objects, onlineUsers],
  )
  const editingIndicators = useMemo(
    () => buildRemoteEditingIndicators(objects, remoteEditors, currentUserId),
    [currentUserId, objects, remoteEditors],
  )

  return (
    <>
      {indicators.map((indicator) => {
        const color = indicator.users[0]?.avatarColor || fallbackSelectionColor
        const label = getSelectionLabel(indicator.users)
        const labelWidth = getSelectionLabelWidth(label)
        const labelPoint = getSelectionLabelPoint(indicator.object, padding)

        return (
          <Group
            key={indicator.object.id}
            listening={false}
          >
            {renderSelectionOutline(
              indicator.object,
              color,
              strokeWidth,
              padding,
              cornerRadius,
              dash,
            )}
            <Group
              x={labelPoint.x}
              y={labelPoint.y - (labelHeight + 8) * screenScale}
              scaleX={screenScale}
              scaleY={screenScale}
              listening={false}
            >
              <Rect
                width={labelWidth}
                height={labelHeight}
                fill={color}
                cornerRadius={5}
                shadowColor="rgba(23, 32, 24, 0.16)"
                shadowBlur={8}
                shadowOffset={{ x: 0, y: 2 }}
                listening={false}
              />
              <Text
                x={labelPaddingX}
                width={labelWidth - labelPaddingX * 2}
                height={labelHeight}
                text={label}
                fill={getReadableTextColor(color)}
                fontSize={12}
                fontStyle="bold"
                fontFamily="sans-serif"
                verticalAlign="middle"
                wrap="none"
                ellipsis
                listening={false}
              />
            </Group>
          </Group>
        )
      })}
      {editingIndicators.map((indicator) => {
        const color =
          indicator.editors[0]?.user.avatarColor || fallbackSelectionColor
        const label = getEditingLabel(indicator.editors)
        const labelWidth = getSelectionLabelWidth(label)
        const labelPoint = getSelectionLabelPoint(indicator.object, padding)

        return (
          <Group
            key={`editing-${indicator.object.id}`}
            listening={false}
          >
            {renderSelectionOutline(
              indicator.object,
              color,
              strokeWidth * 1.5,
              padding * 1.5,
              cornerRadius,
              [],
            )}
            <Group
              x={labelPoint.x}
              y={labelPoint.y - (labelHeight + 36) * screenScale}
              scaleX={screenScale}
              scaleY={screenScale}
              listening={false}
            >
              <Rect
                width={labelWidth}
                height={labelHeight}
                fill={color}
                cornerRadius={5}
                shadowColor="rgba(23, 32, 24, 0.18)"
                shadowBlur={10}
                shadowOffset={{ x: 0, y: 2 }}
                listening={false}
              />
              <Text
                x={labelPaddingX}
                width={labelWidth - labelPaddingX * 2}
                height={labelHeight}
                text={label}
                fill={getReadableTextColor(color)}
                fontSize={12}
                fontStyle="bold"
                fontFamily="sans-serif"
                verticalAlign="middle"
                wrap="none"
                ellipsis
                listening={false}
              />
            </Group>
          </Group>
        )
      })}
    </>
  )
}

function buildRemoteSelectionIndicators(
  objects: Record<string, WhiteboardObject>,
  onlineUsers: OnlineUser[],
  currentUserId: string | null | undefined,
): RemoteSelectionIndicator[] {
  const usersByObjectId = new Map<string, OnlineUser[]>()

  for (const user of onlineUsers) {
    const objectId = user.selectedObjectId

    if (!objectId || user.id === currentUserId) {
      continue
    }

    const object = objects[objectId]

    if (!object || object.deletedAt) {
      continue
    }

    const users = usersByObjectId.get(objectId) ?? []
    users.push(user)
    usersByObjectId.set(objectId, users)
  }

  return [...usersByObjectId.entries()]
    .map(([objectId, users]) => ({
      object: objects[objectId],
      users: users.sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .filter(
      (indicator): indicator is RemoteSelectionIndicator =>
        Boolean(indicator.object),
    )
    .sort((left, right) => {
      if (left.object.zIndex !== right.object.zIndex) {
        return left.object.zIndex - right.object.zIndex
      }

      return left.object.id.localeCompare(right.object.id)
    })
}

function buildRemoteEditingIndicators(
  objects: Record<string, WhiteboardObject>,
  editors: Record<string, Record<string, RemoteEditingState>>,
  currentUserId: string | null | undefined,
): RemoteEditingIndicator[] {
  return Object.entries(editors)
    .flatMap(([objectId, editorsByUserId]) => {
      const object = objects[objectId]

      if (!object || object.deletedAt) {
        return []
      }

      const activeEditors = Object.values(editorsByUserId)
        .filter((editor) => editor.user.id !== currentUserId)
        .sort((left, right) => left.user.name.localeCompare(right.user.name))

      if (activeEditors.length === 0) {
        return []
      }

      return [
        {
          object,
          editors: activeEditors,
        },
      ]
    })
    .sort((left, right) => {
      if (left.object.zIndex !== right.object.zIndex) {
        return left.object.zIndex - right.object.zIndex
      }

      return left.object.id.localeCompare(right.object.id)
    })
}

function renderSelectionOutline(
  object: WhiteboardObject,
  color: string,
  strokeWidth: number,
  padding: number,
  cornerRadius: number,
  dash: number[],
) {
  switch (object.type) {
    case "RECTANGLE":
    case "TEXT": {
      const size = getObjectSize(object)

      return (
        <Group
          x={object.x}
          y={object.y}
          rotation={object.rotation}
          listening={false}
        >
          <Rect
            x={-padding}
            y={-padding}
            width={size.width + padding * 2}
            height={size.height + padding * 2}
            stroke={color}
            strokeWidth={strokeWidth}
            dash={dash}
            cornerRadius={cornerRadius}
            listening={false}
          />
        </Group>
      )
    }
    case "CIRCLE": {
      const size = getObjectSize(object)

      return (
        <Ellipse
          x={object.x + size.width / 2}
          y={object.y + size.height / 2}
          radiusX={size.width / 2 + padding}
          radiusY={size.height / 2 + padding}
          rotation={object.rotation}
          stroke={color}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
      )
    }
    case "LINE": {
      const bounds = getLineBounds(object.points)

      return (
        <Group
          x={object.x}
          y={object.y}
          rotation={object.rotation}
          listening={false}
        >
          <Rect
            x={bounds.x - padding}
            y={bounds.y - padding}
            width={Math.max(1, bounds.width) + padding * 2}
            height={Math.max(1, bounds.height) + padding * 2}
            stroke={color}
            strokeWidth={strokeWidth}
            dash={dash}
            cornerRadius={cornerRadius}
            listening={false}
          />
        </Group>
      )
    }
  }
}

function getObjectSize(object: WhiteboardObject): {
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
        width: object.width ?? defaultShapeWidth,
        height: object.height ?? defaultShapeHeight,
      }
  }
}

function getLineBounds(points: WhiteboardObject["points"]): LineBounds {
  const normalizedPoints =
    points && points.length >= 4 ? points.slice(0, 4) : defaultLinePoints
  const x1 = normalizedPoints[0] ?? 0
  const y1 = normalizedPoints[1] ?? 0
  const x2 = normalizedPoints[2] ?? defaultShapeWidth
  const y2 = normalizedPoints[3] ?? 0
  const minX = Math.min(x1, x2)
  const minY = Math.min(y1, y2)
  const maxX = Math.max(x1, x2)
  const maxY = Math.max(y1, y2)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function getSelectionLabelPoint(
  object: WhiteboardObject,
  padding: number,
): { x: number; y: number } {
  if (object.type === "LINE") {
    const bounds = getLineBounds(object.points)

    return {
      x: object.x + bounds.x - padding,
      y: object.y + bounds.y - padding,
    }
  }

  return {
    x: object.x - padding,
    y: object.y - padding,
  }
}

function getSelectionLabel(users: OnlineUser[]): string {
  const firstName = users[0]?.name.trim() || "User"

  return users.length > 1 ? `${firstName} +${users.length - 1}` : firstName
}

function getEditingLabel(editors: RemoteEditingState[]): string {
  const firstName = editors[0]?.user.name.trim() || "User"

  return editors.length > 1
    ? `${firstName} +${editors.length - 1} editing`
    : `${firstName} editing`
}

function getSelectionLabelWidth(label: string): number {
  return Math.min(
    maxLabelWidth,
    Math.max(minLabelWidth, label.length * 7 + labelPaddingX * 2),
  )
}

function getReadableTextColor(color: string): string {
  const hex = normalizeHexColor(color)

  if (!hex) {
    return "#ffffff"
  }

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.6 ? "#172018" : "#ffffff"
}

function normalizeHexColor(color: string): string | null {
  const trimmedColor = color.trim().replace(/^#/, "")

  if (/^[0-9a-f]{6}$/i.test(trimmedColor)) {
    return trimmedColor
  }

  if (/^[0-9a-f]{3}$/i.test(trimmedColor)) {
    return trimmedColor
      .split("")
      .map((character) => character + character)
      .join("")
  }

  return null
}
