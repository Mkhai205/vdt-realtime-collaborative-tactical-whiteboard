import {
  smallGridStep,
  majorGridStep,
} from "@/lib/canvas-constants"
import type { WorldRect } from "@/lib/canvas-utils"

export type GridLine = {
  id: string
  points: [number, number, number, number]
}

export function padWorldRect(rect: WorldRect, padding: number): WorldRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function alignToStep(value: number, step: number): number {
  return Math.floor(value / step) * step
}

export function isMajorLine(value: number): boolean {
  return Math.abs(value % majorGridStep) < 0.001
}

export function buildGridLines(visibleWorldRect: WorldRect): {
  minor: GridLine[]
  major: GridLine[]
} {
  const paddedRect = padWorldRect(visibleWorldRect, majorGridStep)
  const minor: GridLine[] = []
  const major: GridLine[] = []

  for (
    let x = alignToStep(paddedRect.x, smallGridStep);
    x <= paddedRect.x + paddedRect.width;
    x += smallGridStep
  ) {
    const target = isMajorLine(x) ? major : minor
    target.push({
      id: `v-${x}`,
      points: [x, paddedRect.y, x, paddedRect.y + paddedRect.height],
    })
  }

  for (
    let y = alignToStep(paddedRect.y, smallGridStep);
    y <= paddedRect.y + paddedRect.height;
    y += smallGridStep
  ) {
    const target = isMajorLine(y) ? major : minor
    target.push({
      id: `h-${y}`,
      points: [paddedRect.x, y, paddedRect.x + paddedRect.width, y],
    })
  }

  return { minor, major }
}
