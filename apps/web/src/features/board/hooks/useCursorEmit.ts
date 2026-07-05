/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useCallback, useMemo, useRef } from "react"
import type Konva from "konva"
import { getSocket } from "@/lib/socket/socket"
import { ClientEvents } from "@rctw/shared-contracts"

function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
): T {
  let inThrottle = false
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  } as any
}

export function useCursorEmit(boardId: string) {
  const lastEmittedRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const throttledEmit = useMemo(
    () =>
      throttle(
        (
          x: number,
          y: number,
          viewportCenterX?: number,
          viewportCenterY?: number,
          viewportScale?: number,
        ) => {
          const socket = getSocket()
          if (socket.connected) {
            socket.emit(ClientEvents.CURSOR_MOVE, {
              boardId,
              x,
              y,
              viewportCenterX,
              viewportCenterY,
              viewportScale,
            })
          }
        },
        50,
      ),
    [boardId],
  )

  const onCursorMove = useCallback(
    (stage: Konva.Stage) => {
      const scale = stage.scaleX()
      const viewportCenterX = (window.innerWidth / 2 - stage.x()) / scale
      const viewportCenterY = (window.innerHeight / 2 - stage.y()) / scale

      const pos = stage.getPointerPosition()
      let worldX = lastEmittedRef.current.x
      let worldY = lastEmittedRef.current.y

      if (pos) {
        worldX = (pos.x - stage.x()) / scale
        worldY = (pos.y - stage.y()) / scale
        lastEmittedRef.current = { x: worldX, y: worldY }
      }

      throttledEmit(worldX, worldY, viewportCenterX, viewportCenterY, scale)
    },
    [throttledEmit],
  )

  return { onCursorMove }
}

export type UseCursorEmitReturn = ReturnType<typeof useCursorEmit>
