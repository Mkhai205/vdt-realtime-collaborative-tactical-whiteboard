"use client"

import { useMemo } from "react"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import {
  WhiteboardShapeRenderer,
  type ShapeDefaultColors,
} from "./whiteboard-shape-renderer"

type WhiteboardObjectLayerProps = {
  defaultColors: ShapeDefaultColors
  onObjectPointerDown?: (
    objectId: string,
    event: KonvaEventObject<PointerEvent>,
  ) => void
  registerObjectNode?: (objectId: string, node: Konva.Node | null) => void
}

export function WhiteboardObjectLayer({
  defaultColors,
  onObjectPointerDown,
  registerObjectNode,
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
          onObjectPointerDown={onObjectPointerDown}
          registerObjectNode={registerObjectNode}
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
