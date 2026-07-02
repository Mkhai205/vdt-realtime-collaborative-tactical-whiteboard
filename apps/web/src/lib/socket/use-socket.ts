"use client"

import { useEffect, useCallback, DependencyList } from "react"
import type { ServerEvent, ClientEvent } from "@rctw/shared-contracts"
import { getSocket, emitSocketEvent } from "./socket"

// ─── useSocketEvent ────────────────────────────────────────────────────────────

/**
 * Subscribe to a Socket.IO server event and automatically unsubscribe
 * when the component unmounts or the dependency array changes.
 *
 * @param event   The server event name (from `ServerEvents` constants).
 * @param handler Callback invoked each time the event fires.
 * @param deps    Optional extra deps — the subscription is re-registered when these change.
 *
 * @example
 * useSocketEvent(ServerEvents.BOARD_STATE, (data) => {
 *   initBoard(data)
 * })
 */
export function useSocketEvent<T = unknown>(
  event: ServerEvent,
  handler: (data: T) => void,
  deps: DependencyList = [],
): void {
  useEffect(() => {
    const sock = getSocket()
    const listener = (data: T) => handler(data)

    sock.on(event, listener as (data: unknown) => void)

    return () => {
      sock.off(event, listener as (data: unknown) => void)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps])
}

// ─── useSocketEmit ─────────────────────────────────────────────────────────────

/**
 * Returns a stable `emit` callback that sends typed events to the server.
 *
 * @example
 * const emit = useSocketEmit()
 * emit(ClientEvents.OBJECT_CREATE, { boardId, clientOpId, object: payload })
 */
export function useSocketEmit(): (event: ClientEvent, data: unknown) => void {
  return useCallback((event: ClientEvent, data: unknown) => {
    emitSocketEvent(event, data)
  }, [])
}

// ─── useSocket ─────────────────────────────────────────────────────────────────

/**
 * Convenience hook: returns the raw socket instance.
 * Prefer `useSocketEvent` / `useSocketEmit` for typed interactions.
 */
export function useSocket() {
  return getSocket()
}
