import { io, type Socket } from "socket.io-client"
import type {
  ClientEvent,
  ServerEvent,
} from "@rctw/shared-contracts"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TypedSocket = Socket

// ─── Singleton ─────────────────────────────────────────────────────────────────

let socket: TypedSocket | null = null

/**
 * Get (or lazily create) the Socket.IO singleton connected to the /boards namespace.
 * The socket is NOT auto-connected; call `connectSocket()` when the user enters a board.
 */
export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}/boards`, {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
    })
  }

  return socket
}

/**
 * Connect the socket with a JWT access token.
 * Safe to call multiple times — re-connects with a fresh token if needed.
 */
export function connectSocket(accessToken: string): void {
  const sock = getSocket()

  // Update auth token before connecting / reconnecting
  sock.auth = { token: accessToken }

  if (!sock.connected) {
    sock.connect()
  }
}

/**
 * Gracefully disconnect the socket.
 * Should be called when the user leaves the board page.
 */
export function disconnectSocket(): void {
  socket?.disconnect()
}

/**
 * Update the JWT token stored in socket.auth without disconnecting.
 * Called after a silent token refresh so the next reconnect uses the new token.
 */
export function updateSocketToken(accessToken: string): void {
  if (socket) {
    socket.auth = { token: accessToken }
  }
}

// ─── Typed Emit Helper ─────────────────────────────────────────────────────────

/**
 * Emit a typed socket event.
 * Wraps `socket.emit` to provide compile-time event name safety.
 */
export function emitSocketEvent(event: ClientEvent, data: unknown): void {
  const sock = getSocket()
  sock.emit(event, data)
}

/**
 * Subscribe to a typed server event once.
 * Returns an unsubscribe function.
 */
export function onSocketEvent<T = unknown>(
  event: ServerEvent,
  handler: (data: T) => void,
): () => void {
  const sock = getSocket()
  sock.on(event, handler as (data: unknown) => void)
  return () => sock.off(event, handler as (data: unknown) => void)
}
