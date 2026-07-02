"use client"

import { Group, Rect, Text } from "react-konva"

interface EditingBadgeProps {
  x: number
  y: number
  name: string
  color: string
}

export function EditingBadge({ x, y, name, color }: EditingBadgeProps) {
  // Estimate text width: ~7px per character + padding.
  const textWidth = Math.max(name.length * 7 + 12, 45)

  return (
    <Group x={x} y={y} listening={false}>
      {/* Background container */}
      <Rect
        width={textWidth}
        height={16}
        fill={color}
        cornerRadius={3}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
      {/* Text name label */}
      <Text
        text={name}
        fontSize={9}
        fontStyle="bold"
        fill="#ffffff"
        x={0}
        y={0}
        width={textWidth}
        height={16}
        align="center"
        verticalAlign="middle"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}
