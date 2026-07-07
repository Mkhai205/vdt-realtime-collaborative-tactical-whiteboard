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
import { simplifyFlatPoints } from "../utils/pathUtils"
import { findNearestSnap } from "../utils/arrowBindingUtils"

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
  const type = (tool === "HIGHLIGHTER" ? "PATH" : tool === "ARROW" ? "LINE" : tool) as ObjectType
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
  "ARROW",
  "PATH",
  "HIGHLIGHTER",
  "ICON",
  "TEXT",
  "DIAMOND",
  "TRIANGLE",
  "POLYGON",
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
  createObject: (payload: ObjectCreatePayload, selectMode?: "replace" | "add" | "none") => string | undefined,
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

  // Snap references
  const startSnapRef = useRef<any>(null)
  const endSnapRef = useRef<any>(null)

  const commitShape = useCallback(
    (
      type: ObjectType,
      x: number,
      y: number,
      width: number,
      height: number,
      points: number[] | undefined,
      customStyle?: ShapeStyle,
    ) => {
      const preferredStyle = customStyle || useUIStore.getState().toolStyles[type] || DEFAULT_STYLES[type]
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

      const tempId = createObject(payload, "none")

      // Switch back to SELECT unless keepToolActive is enabled.
      const keepToolActive = useUIStore.getState().keepToolActive
      if (type !== "PATH" && !keepToolActive) {
        useUIStore.getState().setActiveTool("SELECT")
      }

      if (type !== "PATH") {
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
      
      let snappedStart = wp
      let startSnapInfo: any = null
      if (tool === "LINE" || tool === "ARROW") {
        const objects = [...useBoardStore.getState().objects.values()]
        const snap = findNearestSnap(wp, objects)
        if (snap) {
          snappedStart = { x: snap.x, y: snap.y }
          startSnapInfo = snap
        }
      }
      
      startPointRef.current = snappedStart
      startSnapRef.current = startSnapInfo
      endSnapRef.current = null

      if (tool === "PATH" || tool === "HIGHLIGHTER") {
        pathPointsRef.current = [wp.x, wp.y]
      }

      const preferredStyle = useUIStore.getState().toolStyles[tool] || DEFAULT_STYLES[tool as ObjectType] || DEFAULT_STYLES["PATH"]
      const styleCopy = { ...preferredStyle }
      if (startSnapInfo) {
        styleCopy.activeSnapPoint = { x: startSnapInfo.x, y: startSnapInfo.y }
      }

      previewRef.current = buildPreview(tool, snappedStart.x, snappedStart.y, 0, 0, [
        snappedStart.x,
        snappedStart.y,
        snappedStart.x,
        snappedStart.y,
      ], styleCopy)
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

      const preferredStyle = useUIStore.getState().toolStyles[tool] || DEFAULT_STYLES[tool as ObjectType] || DEFAULT_STYLES["PATH"]
      const styleCopy = { ...preferredStyle }

      if (tool === "PATH" || tool === "HIGHLIGHTER") {
        const pts = pathPointsRef.current
        const lastX = pts[pts.length - 2] ?? sx
        const lastY = pts[pts.length - 1] ?? sy
        if (dist(lastX, lastY, ex, ey) >= PATH_SAMPLE_DIST) {
          pathPointsRef.current = [...pts, ex, ey]
        }

        // Real-time Stroke Splitting
        const MAX_POINTS = 500
        const MAX_COORDS = MAX_POINTS * 2
        if (pathPointsRef.current.length >= MAX_COORDS) {
          const committedPoints = pathPointsRef.current.slice(0, MAX_COORDS)
          const relativePts = committedPoints.map((val, idx) => idx % 2 === 0 ? val - sx : val - sy)
          
          const xCoords = relativePts.filter((_, idx) => idx % 2 === 0)
          const yCoords = relativePts.filter((_, idx) => idx % 2 === 1)
          const minX = Math.min(...xCoords)
          const minY = Math.min(...yCoords)
          const maxX = Math.max(...xCoords)
          const maxY = Math.max(...yCoords)
          const w = maxX - minX
          const h = maxY - minY

          // Optimize with RDP simplification
          const optimizedRelativePts = simplifyFlatPoints(relativePts, 1.5)

          // Adjust points to be relative to minX and minY to align with PathObject rendering origin
          const finalPts = optimizedRelativePts.map((val, idx) => idx % 2 === 0 ? val - minX : val - minY)

          commitShape("PATH", sx + minX, sy + minY, w, h, finalPts, preferredStyle)

          const lastPointX = committedPoints[committedPoints.length - 2]!
          const lastPointY = committedPoints[committedPoints.length - 1]!
          const remainingPoints = pathPointsRef.current.slice(MAX_COORDS)
          pathPointsRef.current = [lastPointX, lastPointY, ...remainingPoints]
          startPointRef.current = { x: lastPointX, y: lastPointY }
        }

        previewRef.current = buildPreview(
          tool,
          startPointRef.current.x,
          startPointRef.current.y,
          0,
          0,
          pathPointsRef.current,
          preferredStyle,
        )
      } else if (tool === "LINE" || tool === "ARROW") {
        const objects = [...useBoardStore.getState().objects.values()]
        const snap = findNearestSnap(wp, objects)
        let endX = ex
        let endY = ey

        if (snap) {
          endX = snap.x
          endY = snap.y
          endSnapRef.current = snap
          styleCopy.activeSnapPoint = { x: snap.x, y: snap.y }
        } else {
          endSnapRef.current = null
          if (startSnapRef.current) {
            styleCopy.activeSnapPoint = { x: startSnapRef.current.x, y: startSnapRef.current.y }
          } else {
            delete styleCopy.activeSnapPoint
          }
        }

        previewRef.current = buildPreview(tool, sx, sy, 0, 0, [sx, sy, endX, endY], styleCopy)
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

      if (tool === "PATH" || tool === "HIGHLIGHTER") {
        const pts = pathPointsRef.current
        if (pts.length >= 4) {
          const relativePts = pts.map((val, idx) => idx % 2 === 0 ? val - start.x : val - start.y)
          
          // Optimize relativePts using RDP simplification
          const optimizedRelativePts = simplifyFlatPoints(relativePts, 1.5)
          
          if (optimizedRelativePts.length >= 4) {
            const xCoords = optimizedRelativePts.filter((_, idx) => idx % 2 === 0)
            const yCoords = optimizedRelativePts.filter((_, idx) => idx % 2 === 1)
            const minX = Math.min(...xCoords)
            const minY = Math.min(...yCoords)
            const maxX = Math.max(...xCoords)
            const maxY = Math.max(...yCoords)
            const w = maxX - minX
            const h = maxY - minY

            // Adjust points to be relative to minX and minY to align with PathObject rendering origin
            const finalPts = optimizedRelativePts.map((val, idx) => idx % 2 === 0 ? val - minX : val - minY)

            const preferredStyle = useUIStore.getState().toolStyles[tool] || DEFAULT_STYLES["PATH"]
            commitShape("PATH", start.x + minX, start.y + minY, w, h, finalPts, preferredStyle)
          }
        }
        pathPointsRef.current = []
      } else if (tool === "LINE" || tool === "ARROW") {
        const ex = wp?.x ?? start.x + DEFAULT_SIZE
        const ey = wp?.y ?? start.y

        const objects = [...useBoardStore.getState().objects.values()]
        const snap = findNearestSnap({ x: ex, y: ey }, objects)
        let finalEndX = ex
        let finalEndY = ey
        if (snap) {
          finalEndX = snap.x
          finalEndY = snap.y
          endSnapRef.current = snap
        }

        const relativePts = [0, 0, finalEndX - start.x, finalEndY - start.y]
        const xCoords = [0, finalEndX - start.x]
        const yCoords = [0, finalEndY - start.y]
        const minX = Math.min(...xCoords)
        const minY = Math.min(...yCoords)
        const maxX = Math.max(...xCoords)
        const maxY = Math.max(...yCoords)
        const w = maxX - minX
        const h = maxY - minY

        const finalStyle = {
          ...useUIStore.getState().toolStyles[tool],
        }
        delete finalStyle.activeSnapPoint

        if (startSnapRef.current) {
          finalStyle.startBinding = {
            elementId: startSnapRef.current.elementId,
            anchorRatio: startSnapRef.current.anchorRatio,
          }
        }
        if (endSnapRef.current) {
          finalStyle.endBinding = {
            elementId: endSnapRef.current.elementId,
            anchorRatio: endSnapRef.current.anchorRatio,
          }
        }

        // Relativize points to minX and minY to align with Konva rendering logic!
        const finalPts = [
          0 - minX,
          0 - minY,
          (finalEndX - start.x) - minX,
          (finalEndY - start.y) - minY,
        ]

        commitShape("LINE", start.x + minX, start.y + minY, w, h, finalPts, finalStyle)
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
