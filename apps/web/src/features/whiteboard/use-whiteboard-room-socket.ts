"use client"

import { useEffect } from "react"
import type {
  CursorUpdatedEvent,
  ObjectEditingEvent,
  OperationAppliedEvent,
  OperationRejectedEvent,
  ObjectTransformPreviewedEvent,
  PresenceUpdateEvent,
  RoomStateEvent,
  SocketErrorEvent,
} from "@rctw/shared-contracts"
import { createWhiteboardSocket } from "@/lib/socket-client"
import {
  type WhiteboardOperationSender,
  type WhiteboardOperationSenderOptions,
  type WhiteboardCursorSender,
  type WhiteboardEditingSender,
  type WhiteboardSelectionSender,
  type WhiteboardTransformPreviewSender,
  useWhiteboardStore,
} from "@/stores/whiteboard-store"

type PendingOperation = {
  resolve: (event: OperationAppliedEvent) => void
  reject: (event: OperationRejectedEvent | Error) => void
  tempObjectId?: string
  historyCandidate?: WhiteboardOperationSenderOptions["historyCandidate"]
}

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
    const pendingOperations = new Map<string, PendingOperation>()

    setRoomId(roomId)
    setConnectionStatus("connecting")
    setSocketError(null)
    setObjectOperationSender(createOperationSender())
    setTransformPreviewSender(createTransformPreviewSender())
    setCursorSender(createCursorSender())
    setEditingSender(createEditingSender())
    setSelectionSender(createSelectionSender())

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

    function handleTransformPreviewed(event: ObjectTransformPreviewedEvent) {
      if (event.roomId !== roomId) {
        return
      }

      applyRemoteTransformPreview(event)
    }

    function handleCursorUpdated(event: CursorUpdatedEvent) {
      if (event.roomId !== roomId) {
        return
      }

      applyRemoteCursor(event)
    }

    function handleObjectEditing(event: ObjectEditingEvent) {
      if (event.roomId !== roomId) {
        return
      }

      applyRemoteEditing(event)
    }

    function handleOperationApplied(event: OperationAppliedEvent) {
      if (event.roomId !== roomId) {
        return
      }

      const pendingOperation = pendingOperations.get(event.clientOpId)

      pendingOperations.delete(event.clientOpId)
      applyOperation(event, {
        removeObjectId: pendingOperation?.tempObjectId,
        historyCandidate: pendingOperation?.historyCandidate,
      })
      pendingOperation?.resolve(event)
    }

    function handleOperationRejected(event: OperationRejectedEvent) {
      if (event.roomId !== roomId) {
        return
      }

      const pendingOperation = pendingOperations.get(event.clientOpId)

      pendingOperations.delete(event.clientOpId)

      if (pendingOperation) {
        pendingOperation.reject(event)
        return
      }

      applyOperationRejection(event)
    }

    function createOperationSender(): WhiteboardOperationSender {
      return {
        createObject: (request, options) =>
          emitObjectOperation(
            () => socket.emit("object:create", request),
            request,
            options,
          ),
        updateObject: (request, options) =>
          emitObjectOperation(
            () => socket.emit("object:update", request),
            request,
            options,
          ),
        deleteObject: (request, options) =>
          emitObjectOperation(
            () => socket.emit("object:delete", request),
            request,
            options,
          ),
        undoOperation: (request) =>
          emitObjectOperation(() => socket.emit("undo:request", request), request),
        redoOperation: (request) =>
          emitObjectOperation(() => socket.emit("redo:request", request), request),
      }
    }

    function createTransformPreviewSender(): WhiteboardTransformPreviewSender {
      return {
        sendPreview: (request) => {
          if (request.roomId !== roomId || !socket.connected) {
            return
          }

          socket.emit("object:transform-preview", request)
        },
      }
    }

    function createCursorSender(): WhiteboardCursorSender {
      return {
        sendCursorUpdate: (request) => {
          if (request.roomId !== roomId || !socket.connected) {
            return
          }

          socket.emit("cursor:update", request)
        },
      }
    }

    function createEditingSender(): WhiteboardEditingSender {
      return {
        startEditing: (request) => {
          if (request.roomId !== roomId || !socket.connected) {
            return
          }

          socket.emit("editing:start", request)
        },
        endEditing: (request) => {
          if (request.roomId !== roomId || !socket.connected) {
            return
          }

          socket.emit("editing:end", request)
        },
      }
    }

    function createSelectionSender(): WhiteboardSelectionSender {
      return {
        sendSelectionUpdate: (request) => {
          if (request.roomId !== roomId || !socket.connected) {
            return
          }

          socket.emit("selection:update", request)
        },
      }
    }

    function emitObjectOperation(
      emitOperation: () => void,
      request: { clientOpId: string; roomId: string },
      options?: WhiteboardOperationSenderOptions,
    ): Promise<OperationAppliedEvent> {
      return new Promise((resolve, reject) => {
        if (request.roomId !== roomId) {
          reject(new Error("Object operation targets a different room."))
          return
        }

        if (!socket.connected) {
          reject(new Error("Realtime connection is not ready."))
          return
        }

        pendingOperations.set(request.clientOpId, {
          resolve,
          reject,
          tempObjectId: options?.tempObjectId,
          historyCandidate: options?.historyCandidate,
        })
        emitOperation()
      })
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleConnectError)
    socket.on("room:state", handleRoomState)
    socket.on("presence:update", handlePresenceUpdate)
    socket.on("cursor:updated", handleCursorUpdated)
    socket.on("object:editing", handleObjectEditing)
    socket.on("object:transform-previewed", handleTransformPreviewed)
    socket.on("operation:applied", handleOperationApplied)
    socket.on("operation:rejected", handleOperationRejected)
    socket.on("error", handleSocketError)
    socket.connect()

    return () => {
      setObjectOperationSender(null)
      setTransformPreviewSender(null)
      setCursorSender(null)
      setEditingSender(null)
      setSelectionSender(null)

      for (const pendingOperation of pendingOperations.values()) {
        pendingOperation.reject(
          new Error("Whiteboard socket closed before operation completed."),
        )
      }

      pendingOperations.clear()

      if (socket.connected) {
        socket.emit("room:leave", { roomId })
      }

      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleConnectError)
      socket.off("room:state", handleRoomState)
      socket.off("presence:update", handlePresenceUpdate)
      socket.off("cursor:updated", handleCursorUpdated)
      socket.off("object:editing", handleObjectEditing)
      socket.off("object:transform-previewed", handleTransformPreviewed)
      socket.off("operation:applied", handleOperationApplied)
      socket.off("operation:rejected", handleOperationRejected)
      socket.off("error", handleSocketError)
      socket.disconnect()
    }
  }, [
    applyOperationRejection,
    applyOperation,
    applyRemoteCursor,
    applyRemoteEditing,
    applyRemoteTransformPreview,
    roomId,
    setConnectionStatus,
    setLoadedRoomState,
    setObjectOperationSender,
    setOnlineUsers,
    setRoomId,
    setCursorSender,
    setEditingSender,
    setSelectionSender,
    setSocketError,
    setTransformPreviewSender,
  ])
}
