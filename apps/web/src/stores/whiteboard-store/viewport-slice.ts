import type { StateCreator } from "zustand"
import type { WhiteboardState } from "./types"
import {
  clampScale,
  clampViewport,
  getCenteredViewport,
  initialViewport,
  panViewportBy as panViewport,
  zoomViewportBy as zoomViewport,
  type CanvasPoint,
  type StageSize,
  type Viewport,
} from "@/lib/canvas-utils"

function normalizeStageSize(stageSize: StageSize): StageSize {
  return {
    width: Math.max(0, Math.floor(stageSize.width)),
    height: Math.max(0, Math.floor(stageSize.height)),
  }
}

function normalizeViewport(viewport: Viewport): Viewport {
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : initialViewport.x,
    y: Number.isFinite(viewport.y) ? viewport.y : initialViewport.y,
    scale: clampScale(viewport.scale),
  }
}

function getStageCenter(stageSize: StageSize): CanvasPoint {
  return {
    x: stageSize.width / 2,
    y: stageSize.height / 2,
  }
}

export type ViewportSlice = {
  setStageSize: (stageSize: StageSize) => void
  setViewport: (viewport: Viewport) => void
  panViewportBy: (delta: CanvasPoint) => void
  zoomViewportBy: (factor: number, anchor?: CanvasPoint) => void
  resetViewport: () => void
}

export const createViewportSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  ViewportSlice
> = (set) => ({
  setStageSize: (stageSize) =>
    set((state) => {
      const nextStageSize = normalizeStageSize(stageSize)
      const shouldCenterViewport =
        state.stageSize.width === 0 || state.stageSize.height === 0

      return {
        stageSize: nextStageSize,
        viewport: shouldCenterViewport
          ? getCenteredViewport(nextStageSize)
          : clampViewport(state.viewport, nextStageSize),
      }
    }),
  setViewport: (viewport) =>
    set((state) => ({
      viewport: clampViewport(normalizeViewport(viewport), state.stageSize),
    })),
  panViewportBy: (delta) =>
    set((state) => ({
      viewport: panViewport(state.viewport, delta, state.stageSize),
    })),
  zoomViewportBy: (factor, anchor) =>
    set((state) => ({
      viewport: zoomViewport(
        state.viewport,
        factor,
        anchor ?? getStageCenter(state.stageSize),
        state.stageSize,
      ),
    })),
  resetViewport: () =>
    set((state) => ({
      viewport: getCenteredViewport(state.stageSize),
    })),
})
