/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef } from "react"
import type Konva from "konva"
import type {
  BoardObjectDto,
  ObjectType,
  ObjectCreatePayload,
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
): PreviewShape {
  const type = tool as ObjectType
  return {
    type,
    x,
    y,
    width,
    height,
    points,
    style: { ...DEFAULT_STYLES[type], opacity: 0.6 },
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

const DRAW_TOOLS = new Set<string>([
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "PATH",
  "ICON",
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
  createObject: (payload: ObjectCreatePayload) => void,
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
      const style = { ...DEFAULT_STYLES[type] }

      const payload = {
        type,
        x,
        y,
        width: width || undefined,
        height: height || undefined,
        points: points ?? undefined,
        text: type === "TEXT" ? "" : undefined,
        rotation: 0,
        style,
        zIndex: useBoardStore.getState().objects.size,
      }

      createObject(payload)

      // After creating any shape (except PATH mid-stroke), switch back to SELECT
      if (type !== "PATH") {
        useUIStore.getState().setActiveTool("SELECT")
        useUIStore.getState().setJustCreatedShape(true)
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

      // Only start on the bare stage background, not on existing objects
      if (e.target !== stage) return

      const wp = getWorldPos(stage)
      if (!wp) return

      if (tool === "ICON") {
        commitShape("ICON", wp.x, wp.y, DEFAULT_SIZE, DEFAULT_SIZE, undefined)
        return
      }

      // Drag-to-create tools
      isCreatingRef.current = true
      startPointRef.current = wp

      if (tool === "PATH") {
        pathPointsRef.current = [wp.x, wp.y]
      }

      previewRef.current = buildPreview(tool, wp.x, wp.y, 0, 0, [
        wp.x,
        wp.y,
        wp.x,
        wp.y,
      ])
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
        )
      } else if (tool === "LINE") {
        previewRef.current = buildPreview(tool, sx, sy, 0, 0, [sx, sy, ex, ey])
      } else {
        // RECTANGLE, CIRCLE
        const x = Math.min(sx, ex)
        const y = Math.min(sy, ey)
        const w = Math.abs(ex - sx)
        const h = Math.abs(ey - sy)
        previewRef.current = buildPreview(tool, x, y, w, h, undefined)
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
          commitShape("PATH", start.x, start.y, 0, 0, pts)
        }
        pathPointsRef.current = []
      } else if (tool === "LINE") {
        const ex = wp?.x ?? start.x + DEFAULT_SIZE
        const ey = wp?.y ?? start.y
        commitShape(type, start.x, start.y, 0, 0, [start.x, start.y, ex, ey])
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
