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
export const viewportZoomStep = 1.2

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

export function clampViewport(
  viewport: Viewport,
  stageSize: StageSize,
  bounds: VirtualCanvasBounds = virtualCanvasBounds,
): Viewport {
  const scale = clampScale(viewport.scale)

  return {
    x: clampAxisOffset(viewport.x, stageSize.width, bounds.width, scale),
    y: clampAxisOffset(viewport.y, stageSize.height, bounds.height, scale),
    scale,
  }
}

export function panViewportBy(
  viewport: Viewport,
  delta: CanvasPoint,
  stageSize: StageSize,
  bounds: VirtualCanvasBounds = virtualCanvasBounds,
): Viewport {
  return clampViewport(
    {
      ...viewport,
      x: viewport.x + delta.x,
      y: viewport.y + delta.y,
    },
    stageSize,
    bounds,
  )
}

export function zoomViewportBy(
  viewport: Viewport,
  factor: number,
  anchor: CanvasPoint,
  stageSize: StageSize,
  bounds: VirtualCanvasBounds = virtualCanvasBounds,
): Viewport {
  const currentScale = clampScale(viewport.scale)
  const nextScale = clampScale(currentScale * factor)
  const currentViewport = {
    ...viewport,
    scale: currentScale,
  }

  if (!Number.isFinite(factor) || factor <= 0 || nextScale === currentScale) {
    return clampViewport(currentViewport, stageSize, bounds)
  }

  const anchorWorldPoint = screenToWorld(anchor, currentViewport)

  return clampViewport(
    {
      x: anchor.x - anchorWorldPoint.x * nextScale,
      y: anchor.y - anchorWorldPoint.y * nextScale,
      scale: nextScale,
    },
    stageSize,
    bounds,
  )
}

function clampAxisOffset(
  offset: number,
  stageLength: number,
  worldLength: number,
  scale: number,
): number {
  const safeOffset = Number.isFinite(offset) ? offset : 0

  if (stageLength <= 0 || worldLength <= 0) {
    return safeOffset
  }

  const scaledWorldLength = worldLength * scale

  if (scaledWorldLength <= stageLength) {
    return (stageLength - scaledWorldLength) / 2
  }

  return Math.min(Math.max(safeOffset, stageLength - scaledWorldLength), 0)
}
