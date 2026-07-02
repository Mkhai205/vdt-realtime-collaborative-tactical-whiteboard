import { create } from "zustand"
import type { BoardObjectDto, Tool } from "@rctw/shared-contracts"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Viewport = {
  /** Canvas-to-screen X translation (pixels) */
  x: number
  /** Canvas-to-screen Y translation (pixels) */
  y: number
  /** Zoom scale factor (1 = 100%) */
  scale: number
}

export type DrawingStartPoint = { x: number; y: number }

// ─── State & Actions Interface ─────────────────────────────────────────────────

interface UIState {
  /** Currently active drawing/interaction tool */
  activeTool: Tool

  /** IDs of currently selected canvas objects */
  selectedIds: Set<string>

  /** Objects copied to the clipboard (Ctrl+C) */
  clipboard: BoardObjectDto[]

  /** Camera position in screen-pixel space */
  viewport: Viewport

  /** True while the user is actively drawing a new shape */
  isDrawing: boolean

  /** World-space pointer position where the current draw operation started */
  drawingStartPoint: DrawingStartPoint | null

  /** ID of the user whose cursor we are currently following (null = none) */
  followingUserId: string | null
}

interface UIActions {
  setActiveTool: (tool: Tool) => void

  /** Replace selection with exactly this set of IDs */
  setSelectedIds: (ids: Set<string>) => void
  /** Add one ID to the current selection */
  addToSelection: (id: string) => void
  /** Remove one ID from the current selection */
  removeFromSelection: (id: string) => void
  /** Clear the entire selection */
  clearSelection: () => void

  setClipboard: (objects: BoardObjectDto[]) => void

  setViewport: (viewport: Viewport) => void
  /** Convenience: update viewport fields partially */
  patchViewport: (patch: Partial<Viewport>) => void

  setIsDrawing: (drawing: boolean) => void
  setDrawingStartPoint: (point: DrawingStartPoint | null) => void

  setFollowingUserId: (id: string | null) => void
}

type UIStore = UIState & UIActions

// ─── Constants ─────────────────────────────────────────────────────────────────

export const VIEWPORT_MIN_SCALE = 0.05
export const VIEWPORT_MAX_SCALE = 8.0
export const VIEWPORT_DEFAULT: Viewport = { x: 0, y: 0, scale: 1 }

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIStore>()((set) => ({
  // ── State ──
  activeTool: "SELECT",
  selectedIds: new Set<string>(),
  clipboard: [],
  viewport: VIEWPORT_DEFAULT,
  isDrawing: false,
  drawingStartPoint: null,
  followingUserId: null,

  // ── Actions ──
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      // Switching tools clears any in-progress drawing
      isDrawing: false,
      drawingStartPoint: null,
    }),

  setSelectedIds: (ids) => set({ selectedIds: new Set(ids) }),

  addToSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      next.add(id)
      return { selectedIds: next }
    }),

  removeFromSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      next.delete(id)
      return { selectedIds: next }
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setClipboard: (objects) => set({ clipboard: objects }),

  setViewport: (viewport) =>
    set({
      viewport: {
        x: viewport.x,
        y: viewport.y,
        // Clamp scale to safe limits
        scale: Math.min(
          VIEWPORT_MAX_SCALE,
          Math.max(VIEWPORT_MIN_SCALE, viewport.scale),
        ),
      },
    }),

  patchViewport: (patch) =>
    set((state) => {
      const merged = { ...state.viewport, ...patch }
      return {
        viewport: {
          x: merged.x,
          y: merged.y,
          scale: Math.min(
            VIEWPORT_MAX_SCALE,
            Math.max(VIEWPORT_MIN_SCALE, merged.scale),
          ),
        },
      }
    }),

  setIsDrawing: (drawing) => set({ isDrawing: drawing }),

  setDrawingStartPoint: (point) => set({ drawingStartPoint: point }),

  setFollowingUserId: (followingUserId) => set({ followingUserId }),
}))
