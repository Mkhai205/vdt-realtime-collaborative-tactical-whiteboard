"use client"

import { create } from "zustand"
import {
  clampScale,
  getCenteredViewport,
  initialViewport,
  type StageSize,
  type Viewport,
} from "@/lib/canvas-utils"

type WhiteboardState = {
  roomId: string | null
  viewport: Viewport
  stageSize: StageSize
  setRoomId: (roomId: string) => void
  setStageSize: (stageSize: StageSize) => void
  setViewport: (viewport: Viewport) => void
  resetViewport: () => void
}

const emptyStageSize: StageSize = {
  width: 0,
  height: 0,
}

function normalizeStageSize(stageSize: StageSize): StageSize {
  return {
    width: Math.max(0, Math.floor(stageSize.width)),
    height: Math.max(0, Math.floor(stageSize.height)),
  }
}

function normalizeViewport(viewport: Viewport): Viewport {
  return {
    ...viewport,
    scale: clampScale(viewport.scale),
  }
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  roomId: null,
  viewport: initialViewport,
  stageSize: emptyStageSize,
  setRoomId: (roomId) =>
    set((state) => {
      if (state.roomId === roomId) {
        return state
      }

      return {
        roomId,
        viewport: getCenteredViewport(state.stageSize),
      }
    }),
  setStageSize: (stageSize) =>
    set((state) => {
      const nextStageSize = normalizeStageSize(stageSize)
      const shouldCenterViewport =
        state.stageSize.width === 0 || state.stageSize.height === 0

      return {
        stageSize: nextStageSize,
        viewport: shouldCenterViewport
          ? getCenteredViewport(nextStageSize)
          : state.viewport,
      }
    }),
  setViewport: (viewport) => set({ viewport: normalizeViewport(viewport) }),
  resetViewport: () =>
    set((state) => ({
      viewport: getCenteredViewport(state.stageSize),
    })),
}))
