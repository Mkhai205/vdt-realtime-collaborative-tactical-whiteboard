"use client"

import { useMemo } from "react"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import {
  WhiteboardShapeRenderer,
  type ShapeDefaultColors,
} from "./whiteboard-shape-renderer"

type WhiteboardObjectLayerProps = {
  defaultColors: ShapeDefaultColors
}

export function WhiteboardObjectLayer({
  defaultColors,
}: WhiteboardObjectLayerProps) {
  const objects = useWhiteboardStore((state) => state.objects)

  const visibleObjects = useMemo(
    () =>
      Object.values(objects)
        .filter((object) => !object.deletedAt)
        .sort(compareWhiteboardObjects),
    [objects],
  )

  return (
    <>
      {visibleObjects.map((object) => (
        <WhiteboardShapeRenderer
          key={object.id}
          object={object}
          defaultColors={defaultColors}
        />
      ))}
    </>
  )
}

function compareWhiteboardObjects(
  first: WhiteboardObject,
  second: WhiteboardObject,
): number {
  if (first.zIndex !== second.zIndex) {
    return first.zIndex - second.zIndex
  }

  return first.id.localeCompare(second.id)
}
