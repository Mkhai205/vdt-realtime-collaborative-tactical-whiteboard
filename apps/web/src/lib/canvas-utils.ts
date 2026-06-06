export type CanvasPoint = {
  x: number
  y: number
}

export type StageSize = {
  width: number
  height: number
}

export type Viewport = {
  x: number
  y: number
  scale: number
}

export type VirtualCanvasBounds = {
  width: number
  height: number
}

export type WorldRect = CanvasPoint & {
  width: number
  height: number
}

export const virtualCanvasBounds: VirtualCanvasBounds = {
  width: 20000,
  height: 20000,
}

export const initialViewport: Viewport = {
  x: 0,
  y: 0,
  scale: 1,
}

export const minViewportScale = 0.2
export const maxViewportScale = 4

export function clampScale(scale: number): number {
  return Math.min(Math.max(scale, minViewportScale), maxViewportScale)
}

export function screenToWorld(
  point: CanvasPoint,
  viewport: Viewport,
): CanvasPoint {
  const scale = clampScale(viewport.scale)

  return {
    x: (point.x - viewport.x) / scale,
    y: (point.y - viewport.y) / scale,
  }
}

export function worldToScreen(
  point: CanvasPoint,
  viewport: Viewport,
): CanvasPoint {
  const scale = clampScale(viewport.scale)

  return {
    x: point.x * scale + viewport.x,
    y: point.y * scale + viewport.y,
  }
}

export function getVisibleWorldRect(
  viewport: Viewport,
  stageSize: StageSize,
): WorldRect {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport)
  const bottomRight = screenToWorld(
    { x: stageSize.width, y: stageSize.height },
    viewport,
  )

  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  }
}

export function getCenteredViewport(
  stageSize: StageSize,
  bounds: VirtualCanvasBounds = virtualCanvasBounds,
  scale = initialViewport.scale,
): Viewport {
  const nextScale = clampScale(scale)

  if (stageSize.width <= 0 || stageSize.height <= 0) {
    return {
      ...initialViewport,
      scale: nextScale,
    }
  }

  return {
    x: stageSize.width / 2 - (bounds.width / 2) * nextScale,
    y: stageSize.height / 2 - (bounds.height / 2) * nextScale,
    scale: nextScale,
  }
}
