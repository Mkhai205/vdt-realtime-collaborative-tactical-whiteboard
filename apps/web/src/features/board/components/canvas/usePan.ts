import { useCallback, useRef, useState } from "react"
import type Konva from "konva"
import { useUIStore } from "@/stores/ui.store"

// ─── Hook ───────────────────────────────────────────────────────────────────────

export type UsePanOptions = {
  stageRef: React.RefObject<Konva.Stage | null>
}

export type UsePanReturn = {
  handlePanStart: (e: Konva.KonvaEventObject<MouseEvent>) => void
  handlePanMove: (e: Konva.KonvaEventObject<MouseEvent>) => void
  handlePanEnd: () => void
  /** Call with `true` on Space keydown, `false` on Space keyup */
  setSpaceDown: (down: boolean) => void
  /** Whether a pan is currently in progress (stable ref read) */
  getIsPanning: () => boolean
  isSpaceDown: boolean
  isPanning: boolean
}

/**
 * Handles stage panning:
 * - HAND tool active  → drag the stage on any mouse-down
 * - Spacebar + drag   → pan regardless of the active tool
 *
 * Exposes `getIsPanning()` so `useCanvasEvents` can suppress other tool
 * handlers while a pan is in progress.
 */
export function usePan({ stageRef }: UsePanOptions): UsePanReturn {
  const patchViewport = useUIStore((s) => s.patchViewport)

  const [isSpaceDown, setIsSpaceDownState] = useState(false)
  const [isPanning, setIsPanningState] = useState(false)

  const isPanningRef = useRef(false)
  const isSpaceDownRef = useRef(false)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  // ── Spacebar state setter ──────────────────────────────────────────────────

  const setSpaceDown = useCallback((down: boolean) => {
    isSpaceDownRef.current = down
    setIsSpaceDownState(down)
    // If spacebar released mid-pan, end the pan
    if (!down && isPanningRef.current) {
      isPanningRef.current = false
      setIsPanningState(false)
      lastPointerRef.current = null
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePanStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isHand = useUIStore.getState().activeTool === "HAND"
      const isSpace = isSpaceDownRef.current

      if (!isHand && !isSpace) return
      // Only left-button drag
      if (e.evt.button !== 0) return

      isPanningRef.current = true
      setIsPanningState(true)

      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      lastPointerRef.current = pointer ?? null
    },
    [stageRef],
  )

  const handlePanMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isPanningRef.current) return

      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer || !lastPointerRef.current) return

      const dx = pointer.x - lastPointerRef.current.x
      const dy = pointer.y - lastPointerRef.current.y
      lastPointerRef.current = pointer

      const currentViewport = useUIStore.getState().viewport
      patchViewport({
        x: currentViewport.x + dx,
        y: currentViewport.y + dy,
      })

      if (useUIStore.getState().followingUserId) {
        useUIStore.getState().setFollowingUserId(null)
      }

      // Suppress propagation to other handlers while panning
      e.cancelBubble = true
    },
    [stageRef, patchViewport],
  )

  const handlePanEnd = useCallback(() => {
    isPanningRef.current = false
    setIsPanningState(false)
    lastPointerRef.current = null
  }, [])

  const getIsPanning = useCallback(() => isPanningRef.current, [])

  return {
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    setSpaceDown,
    getIsPanning,
    isSpaceDown,
    isPanning,
  }
}
