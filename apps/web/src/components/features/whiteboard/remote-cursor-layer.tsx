"use client"

import { Group, Line, Rect, Text } from "react-konva"
import { useWhiteboardStore } from "@/stores/whiteboard-store"

const fallbackCursorColor = "#14532d"
const cursorStrokeColor = "rgba(255, 255, 255, 0.92)"
const pointerPoints = [0, 0, 0, 24, 6, 18, 11, 30, 16, 28, 11, 17, 24, 17]
const labelHeight = 24
const labelPaddingX = 7
const maxLabelWidth = 168
const minLabelWidth = 52

export function RemoteCursorLayer({ viewportScale }: { viewportScale: number }) {
  const remoteCursors = useWhiteboardStore((state) => state.remoteCursors)
  const currentUserId = useWhiteboardStore((state) => state.currentUser?.id)
  const cursorScale = 1 / Math.max(viewportScale, 0.001)
  const cursors = Object.values(remoteCursors)
    .filter((cursor) => cursor.user.id !== currentUserId)
    .sort((left, right) => left.user.name.localeCompare(right.user.name))

  return (
    <>
      {cursors.map((cursor) => {
        const color = cursor.user.avatarColor || fallbackCursorColor
        const label = getCursorLabel(cursor.user.name)
        const labelWidth = getCursorLabelWidth(label)

        return (
          <Group
            key={cursor.user.id}
            x={cursor.x}
            y={cursor.y}
            scaleX={cursorScale}
            scaleY={cursorScale}
            listening={false}
          >
            <Line
              points={pointerPoints}
              closed
              fill={color}
              stroke={cursorStrokeColor}
              strokeWidth={1.5}
              lineJoin="round"
              shadowColor="rgba(23, 32, 24, 0.18)"
              shadowBlur={8}
              shadowOffset={{ x: 0, y: 2 }}
              listening={false}
            />
            <Group x={18} y={18} listening={false}>
              <Rect
                width={labelWidth}
                height={labelHeight}
                fill={color}
                cornerRadius={5}
                shadowColor="rgba(23, 32, 24, 0.18)"
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
    </>
  )
}

function getCursorLabel(name: string): string {
  return name.trim() || "User"
}

function getCursorLabelWidth(label: string): number {
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
