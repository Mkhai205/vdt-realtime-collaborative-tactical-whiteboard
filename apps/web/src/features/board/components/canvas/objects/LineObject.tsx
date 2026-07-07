/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from "react"
import { Arrow, Group, Circle } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle, safePoints } from "./shapeDefaults"
import { EditingBadge } from "./EditingBadge"
import { getAvatarColor } from "@/lib/utils"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import {
  computeBindingPoint,
  findNearestSnap,
} from "@/features/board/utils/arrowBindingUtils"
import { useObjectMutations } from "@/features/board/hooks/useObjectMutations"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface LineObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

const EDIT_LOCK_STROKE = "#3b82f6"

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a LINE board object as a Konva Arrow.
 *
 * points  — flat [x1,y1,x2,y2,...] in world-space or relative space; stored in object.points.
 * Arrow head presence is controlled by style.arrowEnd / style.arrowStart.
 * Default: arrowEnd=true, arrowStart=false.
 */
export const LineObject = memo(function LineObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: LineObjectProps) {
  const boardId = useBoardStore((s) => s.boardId)
  const mutations = useObjectMutations(boardId || "")

  const s = resolveStyle("LINE", object.style)
  const pts = safePoints(object.points)
  const rawPoints = pts.length >= 4 ? pts : [0, 0, 100, 0]

  const startBinding = (object.style as any)?.startBinding
  const endBinding = (object.style as any)?.endBinding

  // Query bound target objects dynamically from the store
  const startTarget = useBoardStore((state) =>
    startBinding ? state.objects.get(startBinding.elementId) : undefined,
  )
  const endTarget = useBoardStore((state) =>
    endBinding ? state.objects.get(endBinding.elementId) : undefined,
  )

  // Compute absolute endpoint coordinates (world points)
  const startPtAbs =
    startTarget && startBinding
      ? computeBindingPoint(startTarget, startBinding.anchorRatio)
      : { x: object.x + rawPoints[0]!, y: object.y + rawPoints[1]! }

  const endPtAbs =
    endTarget && endBinding
      ? computeBindingPoint(endTarget, endBinding.anchorRatio)
      : { x: object.x + rawPoints[2]!, y: object.y + rawPoints[3]! }

  const minX = Math.min(startPtAbs.x, endPtAbs.x)
  const minY = Math.min(startPtAbs.y, endPtAbs.y)
  const originalWidth = Math.abs(endPtAbs.x - startPtAbs.x)
  const originalHeight = Math.abs(endPtAbs.y - startPtAbs.y)

  // Relativize points based on computed coordinates
  const relativePts = [
    startPtAbs.x - minX,
    startPtAbs.y - minY,
    endPtAbs.x - minX,
    endPtAbs.y - minY,
  ]

  const groupX = minX
  const groupY = minY

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser
    ? getAvatarColor(editingUser.id)
    : EDIT_LOCK_STROKE
  const badgeWidth = editingUser
    ? Math.max(editingUser.name.length * 7 + 12, 45)
    : 0

  const strokeColor = isEditedByOther ? borderStroke : s.stroke
  const strokeWidth = s.strokeWidth

  const isBound = !!(startTarget && startBinding) || !!(endTarget && endBinding)
  const scaleX =
    !isBound && object.width && originalWidth > 0
      ? object.width / originalWidth
      : 1
  const scaleY =
    !isBound && object.height && originalHeight > 0
      ? object.height / originalHeight
      : 1

  return (
    <Group
      id={object.id}
      x={groupX}
      y={groupY}
      rotation={isBound ? 0 : object.rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable={!isEditedByOther && !isViewer && isSelectTool}
      onDragStart={() => {
        if (object.style?.startBinding || object.style?.endBinding) {
          const newStyle = { ...object.style }
          delete newStyle.startBinding
          delete newStyle.endBinding

          mutations.updateObject(object.id, {
            x: minX,
            y: minY,
            width: originalWidth,
            height: originalHeight,
            points: [
              startPtAbs.x - minX,
              startPtAbs.y - minY,
              endPtAbs.x - minX,
              endPtAbs.y - minY,
            ],
            style: newStyle,
          })
        }
        onDragStart(object.id)
      }}
      onDragMove={(e) => onDragMove(object.id, e.target.x(), e.target.y(), e)}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {/* Hit-area shadow — wider invisible line for easier click targeting */}
      <Arrow
        name="hit-arrow"
        points={relativePts}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth + 8, 12)}
        fill="transparent"
        pointerAtBeginning={false}
        pointerAtEnding={false}
        listening={true}
        perfectDrawEnabled={false}
        onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
        onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      />

      {/* Visible arrow */}
      <Arrow
        name="visible-arrow"
        points={relativePts}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={strokeColor}
        opacity={s.opacity}
        pointerAtBeginning={s.arrowStart}
        pointerAtEnding={s.arrowEnd}
        pointerLength={12}
        pointerWidth={8}
        lineCap="round"
        lineJoin="round"
        dash={isEditedByOther ? [6, 4] : undefined}
        listening={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* Editing-by-other badge */}
      {isEditedByOther && (
        <EditingBadge
          x={originalWidth - badgeWidth}
          y={-20}
          name={editingUser.name}
          color={borderStroke}
        />
      )}

      {/* Endpoint handles for Line/Arrow selection (replacing Transformer rectangular bounds) */}
      {isSelected && !isEditedByOther && !isViewer && isSelectTool && (
        <>
          {/* Start handle */}
          <Circle
            name="start-handle"
            x={relativePts[0]}
            y={relativePts[1]}
            radius={5}
            fill="#ffffff"
            stroke="#6366f1"
            strokeWidth={1.5}
            shadowColor="#6366f1"
            shadowBlur={4}
            shadowOpacity={0.4}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true
            }}
            onDragMove={(e) => {
              e.cancelBubble = true

              const circleNode = e.target
              const groupNode = circleNode.getParent()
              if (!groupNode) return
              const stage = circleNode.getStage()
              if (!stage) return
              const wp = stage.getPointerPosition()
              if (!wp) return

              const scale = stage.scaleX()
              const worldX = (wp.x - stage.x()) / scale
              const worldY = (wp.y - stage.y()) / scale

              const objects = [...useBoardStore.getState().objects.values()]
              const snap = findNearestSnap(
                { x: worldX, y: worldY },
                objects,
                object.id,
              )

              const finalX = snap ? snap.x : worldX
              const finalY = snap ? snap.y : worldY

              const currentPts = safePoints(object.points)
              const rawPoints =
                currentPts.length >= 4 ? currentPts : [0, 0, 100, 0]

              const absStart = { x: finalX, y: finalY }
              const absEnd =
                endTarget && endBinding
                  ? computeBindingPoint(endTarget, endBinding.anchorRatio)
                  : { x: object.x + rawPoints[2]!, y: object.y + rawPoints[3]! }

              const newMinX = Math.min(absStart.x, absEnd.x)
              const newMinY = Math.min(absStart.y, absEnd.y)

              const newPts = [
                absStart.x - newMinX,
                absStart.y - newMinY,
                absEnd.x - newMinX,
                absEnd.y - newMinY,
              ]

              // Imperative canvas node updates (no React re-renders)
              groupNode.position({ x: newMinX, y: newMinY })

              const visibleArrow = groupNode.findOne(".visible-arrow")
              const hitArrow = groupNode.findOne(".hit-arrow")
              if (visibleArrow) (visibleArrow as any).points(newPts)
              if (hitArrow) (hitArrow as any).points(newPts)

              const startHandle = groupNode.findOne(".start-handle")
              const endHandle = groupNode.findOne(".end-handle")
              if (startHandle)
                (startHandle as any).position({ x: newPts[0], y: newPts[1] })
              if (endHandle)
                (endHandle as any).position({ x: newPts[2], y: newPts[3] })

              stage.batchDraw()
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true

              const stage = e.target.getStage()
              if (!stage) return
              const wp = stage.getPointerPosition()
              if (!wp) return

              const scale = stage.scaleX()
              const worldX = (wp.x - stage.x()) / scale
              const worldY = (wp.y - stage.y()) / scale

              const objects = [...useBoardStore.getState().objects.values()]
              const snap = findNearestSnap(
                { x: worldX, y: worldY },
                objects,
                object.id,
              )

              const finalX = snap ? snap.x : worldX
              const finalY = snap ? snap.y : worldY

              const currentPts = safePoints(object.points)
              const rawPoints =
                currentPts.length >= 4 ? currentPts : [0, 0, 100, 0]

              const absStart = { x: finalX, y: finalY }
              const absEnd =
                endTarget && endBinding
                  ? computeBindingPoint(endTarget, endBinding.anchorRatio)
                  : { x: object.x + rawPoints[2]!, y: object.y + rawPoints[3]! }

              const newMinX = Math.min(absStart.x, absEnd.x)
              const newMinY = Math.min(absStart.y, absEnd.y)
              const newW = Math.abs(absEnd.x - absStart.x)
              const newH = Math.abs(absEnd.y - absStart.y)

              const newStyle = { ...object.style } as any
              if (snap) {
                newStyle.startBinding = {
                  elementId: snap.elementId,
                  anchorRatio: snap.anchorRatio,
                }
              } else {
                delete newStyle.startBinding
              }

              const newPts = [
                absStart.x - newMinX,
                absStart.y - newMinY,
                absEnd.x - newMinX,
                absEnd.y - newMinY,
              ]

              mutations.updateObject(object.id, {
                x: newMinX,
                y: newMinY,
                width: newW,
                height: newH,
                points: newPts,
                style: newStyle,
              })
            }}
          />

          {/* End handle */}
          <Circle
            name="end-handle"
            x={relativePts[2]}
            y={relativePts[3]}
            radius={5}
            fill="#ffffff"
            stroke="#6366f1"
            strokeWidth={1.5}
            shadowColor="#6366f1"
            shadowBlur={4}
            shadowOpacity={0.4}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true
            }}
            onDragMove={(e) => {
              e.cancelBubble = true

              const circleNode = e.target
              const groupNode = circleNode.getParent()
              if (!groupNode) return
              const stage = circleNode.getStage()
              if (!stage) return
              const wp = stage.getPointerPosition()
              if (!wp) return

              const scale = stage.scaleX()
              const worldX = (wp.x - stage.x()) / scale
              const worldY = (wp.y - stage.y()) / scale

              const objects = [...useBoardStore.getState().objects.values()]
              const snap = findNearestSnap(
                { x: worldX, y: worldY },
                objects,
                object.id,
              )

              const finalX = snap ? snap.x : worldX
              const finalY = snap ? snap.y : worldY

              const currentPts = safePoints(object.points)
              const rawPoints =
                currentPts.length >= 4 ? currentPts : [0, 0, 100, 0]

              const absStart =
                startTarget && startBinding
                  ? computeBindingPoint(startTarget, startBinding.anchorRatio)
                  : { x: object.x + rawPoints[0]!, y: object.y + rawPoints[1]! }
              const absEnd = { x: finalX, y: finalY }

              const newMinX = Math.min(absStart.x, absEnd.x)
              const newMinY = Math.min(absStart.y, absEnd.y)

              const newPts = [
                absStart.x - newMinX,
                absStart.y - newMinY,
                absEnd.x - newMinX,
                absEnd.y - newMinY,
              ]

              // Imperative canvas node updates (no React re-renders)
              groupNode.position({ x: newMinX, y: newMinY })

              const visibleArrow = groupNode.findOne(".visible-arrow")
              const hitArrow = groupNode.findOne(".hit-arrow")
              if (visibleArrow) (visibleArrow as any).points(newPts)
              if (hitArrow) (hitArrow as any).points(newPts)

              const startHandle = groupNode.findOne(".start-handle")
              const endHandle = groupNode.findOne(".end-handle")
              if (startHandle)
                (startHandle as any).position({ x: newPts[0], y: newPts[1] })
              if (endHandle)
                (endHandle as any).position({ x: newPts[2], y: newPts[3] })

              stage.batchDraw()
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true

              const stage = e.target.getStage()
              if (!stage) return
              const wp = stage.getPointerPosition()
              if (!wp) return

              const scale = stage.scaleX()
              const worldX = (wp.x - stage.x()) / scale
              const worldY = (wp.y - stage.y()) / scale

              const objects = [...useBoardStore.getState().objects.values()]
              const snap = findNearestSnap(
                { x: worldX, y: worldY },
                objects,
                object.id,
              )

              const finalX = snap ? snap.x : worldX
              const finalY = snap ? snap.y : worldY

              const currentPts = safePoints(object.points)
              const rawPoints =
                currentPts.length >= 4 ? currentPts : [0, 0, 100, 0]

              const absStart =
                startTarget && startBinding
                  ? computeBindingPoint(startTarget, startBinding.anchorRatio)
                  : { x: object.x + rawPoints[0]!, y: object.y + rawPoints[1]! }
              const absEnd = { x: finalX, y: finalY }

              const newMinX = Math.min(absStart.x, absEnd.x)
              const newMinY = Math.min(absStart.y, absEnd.y)
              const newW = Math.abs(absEnd.x - absStart.x)
              const newH = Math.abs(absEnd.y - absStart.y)

              const newStyle = { ...object.style } as any
              if (snap) {
                newStyle.endBinding = {
                  elementId: snap.elementId,
                  anchorRatio: snap.anchorRatio,
                }
              } else {
                delete newStyle.endBinding
              }

              const newPts = [
                absStart.x - newMinX,
                absStart.y - newMinY,
                absEnd.x - newMinX,
                absEnd.y - newMinY,
              ]

              mutations.updateObject(object.id, {
                x: newMinX,
                y: newMinY,
                width: newW,
                height: newH,
                points: newPts,
                style: newStyle,
              })
            }}
          />
        </>
      )}
    </Group>
  )
})
