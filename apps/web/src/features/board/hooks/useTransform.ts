import { useCallback } from "react"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { useBoardStore } from "@/stores/board.store"

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Handles Konva Transformer `transformend` events.
 *
 * When Konva scales a node via resize handles it modifies `scaleX/scaleY`
 * rather than `width/height`. This hook converts scale back into real
 * dimensions and persists to the board store (optimistic; socket emit in Plan 08).
 *
 * Special cases:
 * - CIRCLE: Konva stores ellipse at center, so x/y must be adjusted by radius.
 * - LINE/PATH: points-aware resize is deferred; only x/y/rotation updated.
 */
export function useTransform() {
  const onTransformEnd = useCallback(
    (e: KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node
      const id = node.id()
      const objects = useBoardStore.getState().objects
      const obj = objects.get(id)
      if (!obj) return

      // Konva scales the node — convert back to real dimensions
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)

      const rotation = node.rotation()
      const nodeX = node.x()
      const nodeY = node.y()

      let newX = nodeX
      let newY = nodeY
      let newWidth: number | undefined
      let newHeight: number | undefined

      if (obj.type === "CIRCLE") {
        // Konva ellipse Group is placed at center (x + rx, y + ry)
        const originalW = obj.width ?? 100
        const originalH = obj.height ?? 100
        newWidth = (originalW / 2) * scaleX * 2 // = originalW * scaleX
        newHeight = (originalH / 2) * scaleY * 2
        const rx = newWidth / 2
        const ry = newHeight / 2
        // node.x/y() is the center — derive top-left
        newX = nodeX - rx
        newY = nodeY - ry
      } else if (obj.type === "LINE" || obj.type === "PATH") {
        // Points-aware resize deferred; just update position + rotation
        newWidth = obj.width ?? undefined
        newHeight = obj.height ?? undefined
      } else {
        // RECTANGLE, TEXT, ICON, etc.
        newWidth = (obj.width ?? 100) * scaleX
        newHeight = (obj.height ?? 80) * scaleY
      }

      // Optimistic update — socket emit wired in Plan 08
      useBoardStore.getState().upsertObject({
        ...obj,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        rotation,
      })
    },
    [],
  )

  return { onTransformEnd }
}

export type UseTransformReturn = ReturnType<typeof useTransform>
