/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef } from "react"
import type Konva from "konva"
import type {
  BoardObjectDto,
  ObjectType,
  ObjectCreatePayload,
  ShapeStyle,
} from "@rctw/shared-contracts"
import { useUIStore, type PreviewShape } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import { DEFAULT_STYLES } from "../components/canvas/objects/shapeDefaults"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UseShapeCreationReturn = {
  previewShape: PreviewShape | null
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Minimum drag distance (world px) before treating as a drag vs a click */
const MIN_DRAG_PX = 5
/** Default shape size when user just clicks without dragging */
const DEFAULT_SIZE = 100
/** Minimum distance between successive PATH samples (world px) */
const PATH_SAMPLE_DIST = 4

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getWorldPos(stage: Konva.Stage): { x: number; y: number } | null {
  const pos = stage.getPointerPosition()
  if (!pos) return null
  const scale = stage.scaleX()
  return {
    x: (pos.x - stage.x()) / scale,
    y: (pos.y - stage.y()) / scale,
  }
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
}

function buildPreview(
  tool: string,
  x: number,
  y: number,
  width: number,
  height: number,
  points: number[] | undefined,
  style: ShapeStyle,
): PreviewShape {
  const type = tool as ObjectType
  return {
    type,
    x,
    y,
    width,
    height,
    points,
    style,
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

const DRAW_TOOLS = new Set<string>([
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "PATH",
  "ICON",
  "TEXT",
])

/**
 * Handles the full shape-creation mouse flow for all drawing tools.
 *
 * All in-progress state is stored in refs (not React state) to avoid
 * re-renders on every mousemove. The preview is exposed via `sharedPreviewRef`
 * which `DrawingPreview` reads directly from the module.
 *
 * After a shape is committed it is written to the board store (optimistic);
 * socket emission will be wired in Plan 08.
 */
export function useShapeCreation(
  stageRef: React.RefObject<Konva.Stage | null>,
  createObject: (payload: ObjectCreatePayload) => string | undefined,
): UseShapeCreationReturn {
  const { activeTool } = useUIStore()

  // Keep a ref so event handlers always read the latest tool without stale closures.
  // Synced in an effect (not during render) to satisfy React 19 ref rules.
  const activeToolRef = useRef(activeTool)
  useEffect(() => {
    activeToolRef.current = activeTool
  })

  // All drawing state in refs — no re-renders during mouse move
  const isCreatingRef = useRef(false)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const pathPointsRef = useRef<number[]>([])
  const previewRef = useRef<PreviewShape | null>(null)

  const commitShape = useCallback(
    (
      type: ObjectType,
      x: number,
      y: number,
      width: number,
      height: number,
      points: number[] | undefined,
    ) => {
      const preferredStyle = useUIStore.getState().toolStyles[type] || DEFAULT_STYLES[type]
      const style: ShapeStyle = { ...preferredStyle }
      if (type === "TEXT") {
        style.autoWidth = true
      }

      const payload = {
        type,
        x,
        y,
        width: width || undefined,
        height: height || undefined,
        points: points ?? undefined,
        text: type === "TEXT" ? "Double click to edit" : undefined,
        rotation: 0,
        style,
        zIndex: useBoardStore.getState().objects.size,
      }

      const tempId = createObject(payload)

      // After creating any shape (except PATH mid-stroke), switch back to SELECT
      if (type !== "PATH") {
        useUIStore.getState().setActiveTool("SELECT")
        useUIStore.getState().setJustCreatedShape(true)
        if (type === "TEXT" && tempId) {
          useUIStore.getState().setEditingTextId(tempId)
        }
      }
    },
    [createObject],
  )

  // ── Mouse down ─────────────────────────────────────────────────────────────

  const onMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return

      const tool = activeToolRef.current
      if (!DRAW_TOOLS.has(tool)) return
      if (e.evt.button !== 0) return

      const wp = getWorldPos(stage)
      if (!wp) return

      if (tool === "ICON") {
        commitShape("ICON", wp.x, wp.y, DEFAULT_SIZE, DEFAULT_SIZE, undefined)
        return
      }

      if (tool === "TEXT") {
        commitShape("TEXT", wp.x, wp.y, 160, 40, undefined)
        return
      }

      // Drag-to-create tools
      isCreatingRef.current = true
      startPointRef.current = wp

      if (tool === "PATH") {
        pathPointsRef.current = [wp.x, wp.y]
      }

      const preferredStyle = useUIStore.getState().toolStyles[tool] || DEFAULT_STYLES[tool as ObjectType]
      previewRef.current = buildPreview(tool, wp.x, wp.y, 0, 0, [
        wp.x,
        wp.y,
        wp.x,
        wp.y,
      ], preferredStyle)
      useUIStore.getState().setPreviewShape(previewRef.current)
    },
    [stageRef, commitShape],
  )

  // ── Mouse move ─────────────────────────────────────────────────────────────

  const onMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isCreatingRef.current) return
      const stage = stageRef.current
      if (!stage || !startPointRef.current) return

      const tool = activeToolRef.current
      const wp = getWorldPos(stage)
      if (!wp) return

      const { x: sx, y: sy } = startPointRef.current
      const { x: ex, y: ey } = wp

      const preferredStyle = useUIStore.getState().toolStyles[tool] || DEFAULT_STYLES[tool as ObjectType]
      if (tool === "PATH") {
        const pts = pathPointsRef.current
        const lastX = pts[pts.length - 2] ?? sx
        const lastY = pts[pts.length - 1] ?? sy
        if (dist(lastX, lastY, ex, ey) >= PATH_SAMPLE_DIST) {
          pathPointsRef.current = [...pts, ex, ey]
        }
        previewRef.current = buildPreview(
          tool,
          sx,
          sy,
          0,
          0,
          pathPointsRef.current,
          preferredStyle,
        )
      } else if (tool === "LINE") {
        previewRef.current = buildPreview(tool, sx, sy, 0, 0, [sx, sy, ex, ey], preferredStyle)
      } else {
        // RECTANGLE, CIRCLE
        const x = Math.min(sx, ex)
        const y = Math.min(sy, ey)
        const w = Math.abs(ex - sx)
        const h = Math.abs(ey - sy)
        previewRef.current = buildPreview(tool, x, y, w, h, undefined, preferredStyle)
      }

      useUIStore.getState().setPreviewShape(previewRef.current)
    },
    [stageRef],
  )

  // ── Mouse up ───────────────────────────────────────────────────────────────

  const onMouseUp = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isCreatingRef.current) return
      isCreatingRef.current = false

      const stage = stageRef.current
      const tool = activeToolRef.current
      const start = startPointRef.current
      const preview = previewRef.current

      // Clear preview regardless of outcome
      useUIStore.getState().setPreviewShape(null)
      previewRef.current = null

      if (!stage || !start || !preview) {
        startPointRef.current = null
        return
      }

      const wp = getWorldPos(stage)
      const type = tool as ObjectType

      if (tool === "PATH") {
        const pts = pathPointsRef.current
        if (pts.length >= 4) {
          const relativePts = pts.map((val, idx) => idx % 2 === 0 ? val - start.x : val - start.y)
          const xCoords = relativePts.filter((_, idx) => idx % 2 === 0)
          const yCoords = relativePts.filter((_, idx) => idx % 2 === 1)
          const minX = Math.min(...xCoords)
          const minY = Math.min(...yCoords)
          const maxX = Math.max(...xCoords)
          const maxY = Math.max(...yCoords)
          const w = maxX - minX
          const h = maxY - minY
          commitShape("PATH", start.x, start.y, w, h, relativePts)
        }
        pathPointsRef.current = []
      } else if (tool === "LINE") {
        const ex = wp?.x ?? start.x + DEFAULT_SIZE
        const ey = wp?.y ?? start.y
        const relativePts = [0, 0, ex - start.x, ey - start.y]
        const xCoords = [0, ex - start.x]
        const yCoords = [0, ey - start.y]
        const minX = Math.min(...xCoords)
        const minY = Math.min(...yCoords)
        const maxX = Math.max(...xCoords)
        const maxY = Math.max(...yCoords)
        const w = maxX - minX
        const h = maxY - minY
        commitShape(type, start.x, start.y, w, h, relativePts)
      } else {
        // RECTANGLE, CIRCLE
        const ex = wp?.x ?? start.x + DEFAULT_SIZE
        const ey = wp?.y ?? start.y + DEFAULT_SIZE
        const dragDist = dist(start.x, start.y, ex, ey)
        const x = Math.min(start.x, ex)
        const y = Math.min(start.y, ey)
        const w = dragDist > MIN_DRAG_PX ? Math.abs(ex - start.x) : DEFAULT_SIZE
        const h = dragDist > MIN_DRAG_PX ? Math.abs(ey - start.y) : DEFAULT_SIZE
        commitShape(type, x, y, w, h, undefined)
      }

      startPointRef.current = null
    },
    [stageRef, commitShape],
  )

  return {
    get previewShape() {
      return useUIStore.getState().previewShape
    },
    onMouseDown,
    onMouseMove,
    onMouseUp,
  }
}
