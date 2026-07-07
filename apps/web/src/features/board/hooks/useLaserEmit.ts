/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useCallback, useMemo } from "react"
import { getSocket } from "@/lib/socket/socket"
import { ClientEvents } from "@rctw/shared-contracts"

// ─── Util ───────────────────────────────────────────────────────────────────────

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let lastCallTime = 0

  const execute = () => {
    if (lastArgs) {
      fn.apply(lastThis, lastArgs)
      lastCallTime = Date.now()
      lastArgs = null
      lastThis = null
      timeout = setTimeout(execute, ms)
    } else {
      timeout = null
    }
  }

  return function (this: any, ...args: any[]) {
    const now = Date.now()
    const remaining = ms - (now - lastCallTime)

    if (remaining <= 0 || remaining > ms) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      fn.apply(this, args)
      lastCallTime = now
    } else {
      lastArgs = args
      lastThis = this
      if (!timeout) {
        timeout = setTimeout(execute, remaining)
      }
    }
  } as any
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Emits laser events to the server via Socket.IO.
 *
 * - `emitMove(x, y)`: throttled at 50 ms — sent while cursor moves in LASER mode
 * - `emitStop()`: signals that the user left LASER mode (isActive: false)
 * - `emitPing(x, y)`: fire-and-forget ping at a world position on click
 */
export function useLaserEmit(boardId: string) {
  const throttledMove = useMemo(
    () =>
      throttle((x: number, y: number, strokeId?: string) => {
        const socket = getSocket()
        if (!socket.connected) return
        socket.emit(ClientEvents.LASER_MOVE, { boardId, x, y, isActive: true, strokeId })
      }, 50),
    [boardId],
  )

  const emitMove = useCallback(
    (x: number, y: number, strokeId?: string) => {
      throttledMove(x, y, strokeId)
    },
    [throttledMove],
  )

  const emitStop = useCallback((strokeId?: string) => {
    const socket = getSocket()
    if (!socket.connected) return
    socket.emit(ClientEvents.LASER_MOVE, { boardId, x: 0, y: 0, isActive: false, strokeId })
  }, [boardId])

  return { emitMove, emitStop }
}

export type UseLaserEmitReturn = ReturnType<typeof useLaserEmit>
