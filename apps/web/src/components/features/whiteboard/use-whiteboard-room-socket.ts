"use client"

import { useEffect } from "react"
import { createWhiteboardSocket } from "@/lib/socket-client"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { WhiteboardRoomSocketSession } from "./whiteboard-room-socket-session"

export function useWhiteboardRoomSocket(roomId: string): void {
  const setRoomId = useWhiteboardStore((state) => state.setRoomId)
  const setLoadedRoomState = useWhiteboardStore(
    (state) => state.setLoadedRoomState,
  )
  const setObjectsWithRevision = useWhiteboardStore(
    (state) => state.setObjectsWithRevision,
  )
  const setConnectionStatus = useWhiteboardStore(
    (state) => state.setConnectionStatus,
  )
  const setSocketError = useWhiteboardStore((state) => state.setSocketError)
  const setOnlineUsers = useWhiteboardStore((state) => state.setOnlineUsers)
  const setObjectOperationSender = useWhiteboardStore(
    (state) => state.setObjectOperationSender,
  )
  const setTransformPreviewSender = useWhiteboardStore(
    (state) => state.setTransformPreviewSender,
  )
  const setCursorSender = useWhiteboardStore((state) => state.setCursorSender)
  const setEditingSender = useWhiteboardStore(
    (state) => state.setEditingSender,
  )
  const setSelectionSender = useWhiteboardStore(
    (state) => state.setSelectionSender,
  )
  const applyOperation = useWhiteboardStore((state) => state.applyOperation)
  const markRevisionSynced = useWhiteboardStore(
    (state) => state.markRevisionSynced,
  )
  const applyOperationRejection = useWhiteboardStore(
    (state) => state.applyOperationRejection,
  )
  const applyRemoteTransformPreview = useWhiteboardStore(
    (state) => state.applyRemoteTransformPreview,
  )
  const applyRemoteCursor = useWhiteboardStore(
    (state) => state.applyRemoteCursor,
  )
  const applyRemoteEditing = useWhiteboardStore(
    (state) => state.applyRemoteEditing,
  )

  useEffect(() => {
    const socket = createWhiteboardSocket()
    const session = new WhiteboardRoomSocketSession(socket, roomId, {
      setRoomId,
      setLoadedRoomState,
      setObjectsWithRevision,
      setConnectionStatus,
      setSocketError,
      setOnlineUsers,
      setObjectOperationSender,
      setTransformPreviewSender,
      setCursorSender,
      setEditingSender,
      setSelectionSender,
      applyOperation,
      markRevisionSynced,
      applyOperationRejection,
      applyRemoteTransformPreview,
      applyRemoteCursor,
      applyRemoteEditing,
      getLastSeenRevision: () => useWhiteboardStore.getState().lastSeenRevision,
    })

    session.connect()

    return () => {
      session.disconnect()
    }
  }, [
    applyOperationRejection,
    applyOperation,
    applyRemoteCursor,
    applyRemoteEditing,
    applyRemoteTransformPreview,
    markRevisionSynced,
    roomId,
    setConnectionStatus,
    setLoadedRoomState,
    setObjectOperationSender,
    setOnlineUsers,
    setObjectsWithRevision,
    setRoomId,
    setCursorSender,
    setEditingSender,
    setSelectionSender,
    setSocketError,
    setTransformPreviewSender,
  ])
}
