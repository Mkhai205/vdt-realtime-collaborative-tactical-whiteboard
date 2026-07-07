import type { BoardObjectDto } from "@rctw/shared-contracts"

export type PointKey = "center" | "top" | "right" | "bottom" | "left"

export interface AttachmentPoint {
  key: PointKey
  x: number
  y: number
  anchorRatio: { x: number; y: number }
}

export interface SnapResult {
  elementId: string
  pointKey: PointKey
  anchorRatio: { x: number; y: number }
  x: number
  y: number
}

/** Snap threshold in world coordinates (view-independent). */
export const ARROW_SNAP_THRESHOLD = 20

/** Rotates a point around a center by an angle in radians. */
export function rotatePoint(
  p: { x: number; y: number },
  center: { x: number; y: number },
  angleRad: number,
): { x: number; y: number } {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

/** Returns the 5 attachment points for a BoardObjectDto (center, top, right, bottom, left). */
export function getAttachmentPoints(el: BoardObjectDto): AttachmentPoint[] {
  const w = el.width ?? 0
  const h = el.height ?? 0
  const cx = el.x + w / 2
  const cy = el.y + h / 2

  const points: AttachmentPoint[] = [
    { key: "center", x: cx, y: cy, anchorRatio: { x: 0.5, y: 0.5 } },
    { key: "top", x: cx, y: el.y, anchorRatio: { x: 0.5, y: 0 } },
    { key: "right", x: el.x + w, y: cy, anchorRatio: { x: 1, y: 0.5 } },
    { key: "bottom", x: cx, y: el.y + h, anchorRatio: { x: 0.5, y: 1 } },
    { key: "left", x: el.x, y: cy, anchorRatio: { x: 0, y: 0.5 } },
  ]

  if (!el.rotation) return points

  const angleRad = (el.rotation * Math.PI) / 180
  const center = { x: cx, y: cy }

  return points.map((ap) => {
    if (ap.key === "center") return ap
    const rotated = rotatePoint({ x: ap.x, y: ap.y }, center, angleRad)
    return { ...ap, x: rotated.x, y: rotated.y }
  })
}

/** Finds the nearest snap point for a given absolute point coordinate. */
export function findNearestSnap(
  pt: { x: number; y: number },
  objects: BoardObjectDto[],
  excludeId?: string,
): SnapResult | null {
  let bestDist = ARROW_SNAP_THRESHOLD
  let best: SnapResult | null = null
  let bestZIndex = -Infinity

  for (const el of objects) {
    if (el.type === "LINE" || el.type === "PATH") continue
    if (excludeId && el.id === excludeId) continue

    for (const ap of getAttachmentPoints(el)) {
      const dx = pt.x - ap.x
      const dy = pt.y - ap.y
      const d = Math.sqrt(dx * dx + dy * dy)
      const zIndex = el.zIndex ?? 0

      if (d < bestDist || (d === bestDist && zIndex > bestZIndex)) {
        bestDist = d
        bestZIndex = zIndex
        best = {
          elementId: el.id,
          pointKey: ap.key,
          anchorRatio: ap.anchorRatio,
          x: ap.x,
          y: ap.y,
        }
      }
    }
  }

  return best
}

/** Computes the world position of an anchor ratio binding. */
export function computeBindingPoint(
  target: BoardObjectDto,
  anchorRatio: { x: number; y: number },
): { x: number; y: number } {
  const w = target.width ?? 0
  const h = target.height ?? 0
  const cx = target.x + w / 2
  const cy = target.y + h / 2

  const unrotated = {
    x: target.x + w * anchorRatio.x,
    y: target.y + h * anchorRatio.y,
  }

  if (!target.rotation) return unrotated

  const angleRad = (target.rotation * Math.PI) / 180
  return rotatePoint(unrotated, { x: cx, y: cy }, angleRad)
}
