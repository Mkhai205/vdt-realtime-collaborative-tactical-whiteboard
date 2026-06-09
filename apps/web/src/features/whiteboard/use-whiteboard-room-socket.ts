"use client"

import { useEffect } from "react"
import type {
  PresenceUpdateEvent,
  RoomStateEvent,
  SocketErrorEvent,
} from "@rctw/shared-contracts"
import { createWhiteboardSocket } from "@/lib/socket-client"
import { useWhiteboardStore } from "@/stores/whiteboard-store"

export function useWhiteboardRoomSocket(roomId: string): void {
  const setRoomId = useWhiteboardStore((state) => state.setRoomId)
  const setLoadedRoomState = useWhiteboardStore(
    (state) => state.setLoadedRoomState,
  )
  const setConnectionStatus = useWhiteboardStore(
    (state) => state.setConnectionStatus,
  )
  const setSocketError = useWhiteboardStore((state) => state.setSocketError)
  const setOnlineUsers = useWhiteboardStore((state) => state.setOnlineUsers)

  useEffect(() => {
    const socket = createWhiteboardSocket()

    setRoomId(roomId)
    setConnectionStatus("connecting")
    setSocketError(null)

    function handleConnect() {
      setConnectionStatus("connected")
      setSocketError(null)
      socket.emit("room:join", { roomId })
    }

    function handleDisconnect() {
      setConnectionStatus(socket.active ? "reconnecting" : "disconnected")
    }

    function handleConnectError(error: Error) {
      setConnectionStatus(socket.active ? "reconnecting" : "disconnected")
      setSocketError(error.message || "Socket connection failed.")
    }

    function handleRoomState(event: RoomStateEvent) {
      if (event.room.id !== roomId) {
        return
      }

      setLoadedRoomState({
        room: event.room,
        currentUser: event.currentUser,
        currentRevision: event.room.currentRevision,
        objects: event.objects,
        onlineUsers: event.onlineUsers,
      })
    }

    function handlePresenceUpdate(event: PresenceUpdateEvent) {
      if (event.roomId !== roomId) {
        return
      }

      setOnlineUsers(event.onlineUsers)
    }

    function handleSocketError(event: SocketErrorEvent) {
      setSocketError(event.message)
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleConnectError)
    socket.on("room:state", handleRoomState)
    socket.on("presence:update", handlePresenceUpdate)
    socket.on("error", handleSocketError)
    socket.connect()

    return () => {
      if (socket.connected) {
        socket.emit("room:leave", { roomId })
      }

      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleConnectError)
      socket.off("room:state", handleRoomState)
      socket.off("presence:update", handlePresenceUpdate)
      socket.off("error", handleSocketError)
      socket.disconnect()
    }
  }, [
    roomId,
    setConnectionStatus,
    setLoadedRoomState,
    setOnlineUsers,
    setRoomId,
    setSocketError,
  ])
}
