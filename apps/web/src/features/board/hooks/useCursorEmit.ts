/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useCallback, useMemo } from "react"
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
  const throttledEmit = useMemo(
    () =>
      throttle((x: number, y: number) => {
        const socket = getSocket()
        if (socket.connected) {
          socket.emit(ClientEvents.CURSOR_MOVE, { boardId, x, y })
        }
      }, 50),
    [boardId],
  )

  const onCursorMove = useCallback(
    (stage: Konva.Stage) => {
      const pos = stage.getPointerPosition()
      if (!pos) return
      const scale = stage.scaleX()
      const worldX = (pos.x - stage.x()) / scale
      const worldY = (pos.y - stage.y()) / scale
      throttledEmit(worldX, worldY)
    },
    [throttledEmit],
  )

  return { onCursorMove }
}

export type UseCursorEmitReturn = ReturnType<typeof useCursorEmit>
