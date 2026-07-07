import { create } from "zustand"
import type { BoardObjectDto, Tool, ObjectType, ShapeStyle, BoardSnapshotDetailResponse } from "@rctw/shared-contracts"
import { DEFAULT_STYLES } from "../features/board/components/canvas/objects/shapeDefaults"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PreviewShape = {
  type: ObjectType
  x: number
  y: number
  width?: number
  height?: number
  points?: number[]
  style: BoardObjectDto["style"]
}

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
  activeTool: Tool | "HIGHLIGHTER" | "ARROW" | "LASER"

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

  /** True while the spacebar is currently pressed down */
  isSpacePressed: boolean

  /** The current in-progress drawing preview shape */
  previewShape: PreviewShape | null

  /** ID of the text object currently being edited by the local user */
  editingTextId: string | null

  /** Transient flag to prevent immediately clearing selection on shape creation click */
  justCreatedShape: boolean

  /** Preferred default styles for each drawing tool */
  toolStyles: Record<string, ShapeStyle>

  /** If true, keep the currently active tool selected after drawing instead of switching to SELECT */
  keepToolActive: boolean

  /** Previewing a history snapshot (null = not in history preview mode) */
  previewSnapshot: BoardSnapshotDetailResponse | null
}

interface UIActions {
  setActiveTool: (tool: Tool | "HIGHLIGHTER" | "ARROW" | "LASER") => void

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

  setIsSpacePressed: (pressed: boolean) => void

  setPreviewShape: (shape: PreviewShape | null) => void

  setEditingTextId: (id: string | null) => void

  setJustCreatedShape: (val: boolean) => void

  setToolStyle: (tool: Tool | "HIGHLIGHTER" | "ARROW" | "LASER", patch: Partial<ShapeStyle>) => void

  setKeepToolActive: (val: boolean) => void

  setPreviewSnapshot: (snapshot: BoardSnapshotDetailResponse | null) => void
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
  isSpacePressed: false,
  previewShape: null,
  editingTextId: null,
  justCreatedShape: false,
  toolStyles: {
    RECTANGLE: { ...DEFAULT_STYLES.RECTANGLE },
    CIRCLE: { ...DEFAULT_STYLES.CIRCLE },
    DIAMOND: { ...DEFAULT_STYLES.DIAMOND },
    TRIANGLE: { ...DEFAULT_STYLES.TRIANGLE },
    POLYGON: { ...DEFAULT_STYLES.POLYGON },
    LINE: { ...DEFAULT_STYLES.LINE },
    ARROW: {
      stroke: "#374151",
      fill: "transparent",
      strokeWidth: 3,
      opacity: 1,
      arrowStart: false,
      arrowEnd: true,
    },
    PATH: { ...DEFAULT_STYLES.PATH },
    HIGHLIGHTER: {
      stroke: "#facc15",
      fill: "transparent",
      strokeWidth: 14,
      opacity: 0.35,
    },
    ICON: { ...DEFAULT_STYLES.ICON },
    TEXT: { ...DEFAULT_STYLES.TEXT },
  },
  keepToolActive: false,
  previewSnapshot: null,

  // ── Actions ──
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      // Switching tools clears any in-progress drawing
      isDrawing: false,
      drawingStartPoint: null,
      previewShape: null,
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

  setIsSpacePressed: (pressed) => set({ isSpacePressed: pressed }),

  setPreviewShape: (previewShape) => set({ previewShape }),

  setEditingTextId: (editingTextId) => set({ editingTextId }),

  setJustCreatedShape: (justCreatedShape) => set({ justCreatedShape }),

  setToolStyle: (tool, patch) =>
    set((state) => {
      const currentToolStyle = state.toolStyles[tool] || {}
      return {
        toolStyles: {
          ...state.toolStyles,
          [tool]: {
            ...currentToolStyle,
            ...patch,
          },
        },
      }
    }),

  setKeepToolActive: (keepToolActive) => set({ keepToolActive }),

  setPreviewSnapshot: (previewSnapshot) => set({ previewSnapshot }),
}))
