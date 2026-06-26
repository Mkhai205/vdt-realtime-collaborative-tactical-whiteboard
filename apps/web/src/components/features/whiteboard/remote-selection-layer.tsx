"use client"

import { useMemo } from "react"
import type { OnlineUser, WhiteboardObject } from "@rctw/shared-contracts"
import { Ellipse, Group, Rect, Text } from "react-konva"
import {
  defaultRectangleWidth,
  defaultRectangleHeight,
  defaultCircleSize,
  defaultTextWidth,
  defaultTextHeight,
  defaultLinePoints,
} from "@/lib/canvas-constants"
import { readableForegroundColor } from "@/lib/color-utils"
import {
  type RemoteEditingState,
  useWhiteboardStore,
} from "@/stores/whiteboard-store"

const fallbackSelectionColor = "#14532d"
const labelHeight = 24
const labelPaddingX = 7
const maxLabelWidth = 176
const minLabelWidth = 56

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
                fill={readableForegroundColor(color, "#ffffff")}
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
                fill={readableForegroundColor(color, "#ffffff")}
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
    case "TEXT":
    case "ICON": {
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
    case "LINE":
    case "PATH": {
      const bounds = getPathBounds(object.points)

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
    case "PATH":
    case "ICON":
      return {
        width: object.width ?? defaultRectangleWidth,
        height: object.height ?? defaultRectangleHeight,
      }
  }
}

function getPathBounds(points: WhiteboardObject["points"]): LineBounds {
  if (!points || points.length === 0) {
    return {
      x: 0,
      y: 0,
      width: defaultRectangleWidth,
      height: defaultRectangleHeight,
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    if (x !== undefined && y !== undefined) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (minX === Infinity || minY === Infinity) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

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
  if (object.type === "LINE" || object.type === "PATH") {
    const bounds = getPathBounds(object.points)

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
