"use client"

import { useMemo } from "react"
import type {
  ObjectTransformPreviewPatch,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import {
  WhiteboardShapeRenderer,
  type ShapeDefaultColors,
} from "./whiteboard-shape-renderer"

type WhiteboardObjectLayerProps = {
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
  onObjectDragMove?: (
    objectId: string,
    event: KonvaEventObject<DragEvent>,
  ) => void
  registerObjectNode?: (objectId: string, node: Konva.Node | null) => void
}

export function WhiteboardObjectLayer({
  defaultColors,
  draggable = false,
  onObjectPointerDown,
  onObjectDragEnd,
  onObjectDragMove,
  registerObjectNode,
}: WhiteboardObjectLayerProps) {
  const objects = useWhiteboardStore((state) => state.objects)
  const remoteTransformPreviews = useWhiteboardStore(
    (state) => state.remoteTransformPreviews,
  )

  const visibleObjects = useMemo(
    () =>
      Object.values(objects)
        .filter((object) => !object.deletedAt)
        .map((object) => {
          const preview = remoteTransformPreviews[object.id]?.preview

          return preview ? applyTransformPreview(object, preview) : object
        })
        .sort(compareWhiteboardObjects),
    [objects, remoteTransformPreviews],
  )

  return (
    <>
      {visibleObjects.map((object) => (
        <WhiteboardShapeRenderer
          key={object.id}
          object={object}
          defaultColors={defaultColors}
          draggable={draggable}
          onObjectPointerDown={onObjectPointerDown}
          onObjectDragEnd={onObjectDragEnd}
          onObjectDragMove={onObjectDragMove}
          registerObjectNode={registerObjectNode}
        />
      ))}
    </>
  )
}

function applyTransformPreview(
  object: WhiteboardObject,
  preview: ObjectTransformPreviewPatch,
): WhiteboardObject {
  return {
    ...object,
    x: preview.x ?? object.x,
    y: preview.y ?? object.y,
    width: preview.width ?? object.width,
    height: preview.height ?? object.height,
    points: preview.points ?? object.points,
    rotation: preview.rotation ?? object.rotation,
  }
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
