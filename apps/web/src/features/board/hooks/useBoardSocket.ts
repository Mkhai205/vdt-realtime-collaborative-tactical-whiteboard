"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth.store"
import { useBoardStore } from "@/stores/board.store"
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket/socket"
import { ClientEvents } from "@rctw/shared-contracts"
import { useBoardEvents } from "./useBoardEvents"
import { useReconnectSync } from "./useReconnectSync"

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"

export function useBoardSocket(boardId: string) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    () => {
      if (typeof window !== "undefined") {
        const token = useAuthStore.getState().accessToken
        if (!token) return "disconnected"
        // If socket is already initialized and connected, start as "connected"
        const socket = getSocket()
        return socket.connected ? "connected" : "connecting"
      }
      return "connecting"
    },
  )

  // Mount event subscriptions & reconnection sync handlers
  useBoardEvents(boardId)
  useReconnectSync(boardId)

  useEffect(() => {
    const accessToken = useAuthStore.getState().accessToken
    if (!accessToken) return

    const socket = getSocket()

    const onConnect = () => setConnectionStatus("connected")
    const onDisconnect = () => setConnectionStatus("disconnected")
    const onConnectError = () => setConnectionStatus("disconnected")
    const onReconnectAttempt = () => setConnectionStatus("reconnecting")

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("connect_error", onConnectError)
    socket.io.on("reconnect_attempt", onReconnectAttempt)

    // Connect and join the room
    connectSocket(accessToken)

    // If socket is already connected when this effect runs, trigger the join
    if (socket.connected) {
      // Avoid calling state updates synchronously in effect: schedule to next microtask
      queueMicrotask(() => {
        setConnectionStatus("connected")
      })
      socket.emit(ClientEvents.BOARD_JOIN, { boardId })
    } else {
      socket.once("connect", () => {
        socket.emit(ClientEvents.BOARD_JOIN, { boardId })
      })
    }

    return () => {
      // Clean up when leaving board
      socket.emit(ClientEvents.BOARD_LEAVE, { boardId })
      disconnectSocket()
      useBoardStore.getState().resetBoard()

      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("connect_error", onConnectError)
      socket.io.off("reconnect_attempt", onReconnectAttempt)
    }
  }, [boardId])

  return { connectionStatus }
}
