import type {
  CursorUpdatedEvent,
  ObjectEditingEvent,
  OperationAppliedEvent,
  OperationRejectedEvent,
  ObjectTransformPreviewedEvent,
  PresenceUpdateEvent,
  BoardStateEvent as RoomStateEvent,
  SocketErrorEvent,
  SyncResponse,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type { WhiteboardSocket } from "@/lib/socket-client"
import type {
  WhiteboardOperationSender,
  WhiteboardOperationSenderOptions,
  WhiteboardCursorSender,
  WhiteboardEditingSender,
  WhiteboardSelectionSender,
  WhiteboardTransformPreviewSender,
  WhiteboardCurrentUser,
  ConnectionStatus,
  WhiteboardApplyOperationOptions,
} from "@/stores/whiteboard-store"

export type PendingOperation = {
  resolve: (event: OperationAppliedEvent) => void
  reject: (event: OperationRejectedEvent | Error) => void
  tempObjectId?: string
  historyCandidate?: WhiteboardOperationSenderOptions["historyCandidate"]
}

export interface WhiteboardStoreActions {
  setRoomId: (roomId: string) => void
  setLoadedRoomState: (state: {
    room: RoomStateEvent["board"]
    currentUser: WhiteboardCurrentUser
    currentRevision: number
    objects: WhiteboardObject[]
    onlineUsers?: PresenceUpdateEvent["onlineUsers"]
  }) => void
  setObjectsWithRevision: (objects: WhiteboardObject[], revision: number) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setSocketError: (message: string | null) => void
  setOnlineUsers: (onlineUsers: PresenceUpdateEvent["onlineUsers"]) => void
  setObjectOperationSender: (sender: WhiteboardOperationSender | null) => void
  setTransformPreviewSender: (sender: WhiteboardTransformPreviewSender | null) => void
  setCursorSender: (sender: WhiteboardCursorSender | null) => void
  setEditingSender: (sender: WhiteboardEditingSender | null) => void
  setSelectionSender: (sender: WhiteboardSelectionSender | null) => void
  applyOperation: (operation: OperationAppliedEvent, options?: WhiteboardApplyOperationOptions) => void
  markRevisionSynced: (revision: number) => void
  applyOperationRejection: (rejection: OperationRejectedEvent) => void
  applyRemoteTransformPreview: (event: ObjectTransformPreviewedEvent) => void
  applyRemoteCursor: (event: CursorUpdatedEvent) => void
  applyRemoteEditing: (event: ObjectEditingEvent) => void
  getLastSeenRevision: () => number
}

export class WhiteboardRoomSocketSession {
  private socket: WhiteboardSocket
  private roomId: string
  private actions: WhiteboardStoreActions

  public pendingOperations = new Map<string, PendingOperation>()
  public bufferedOperations: OperationAppliedEvent[] = []
  public hasLoadedInitialRoomState = false
  public isSyncing = false

  constructor(socket: WhiteboardSocket, roomId: string, actions: WhiteboardStoreActions) {
    this.socket = socket;
    this.roomId = roomId;
    this.actions = actions;
  }

  public connect(): void {
    this.actions.setRoomId(this.roomId)
    this.actions.setConnectionStatus("connecting")
    this.actions.setSocketError(null)

    this.actions.setObjectOperationSender(this.createOperationSender())
    this.actions.setTransformPreviewSender(this.createTransformPreviewSender())
    this.actions.setCursorSender(this.createCursorSender())
    this.actions.setEditingSender(this.createEditingSender())
    this.actions.setSelectionSender(this.createSelectionSender())

    this.bindEvents()
    this.socket.connect()
  }

  public disconnect(): void {
    this.actions.setObjectOperationSender(null)
    this.actions.setTransformPreviewSender(null)
    this.actions.setCursorSender(null)
    this.actions.setEditingSender(null)
    this.actions.setSelectionSender(null)

    for (const pendingOperation of this.pendingOperations.values()) {
      pendingOperation.reject(
        new Error("Whiteboard socket closed before operation completed."),
      )
    }

    this.pendingOperations.clear()
    this.bufferedOperations.length = 0

    if (this.socket.connected) {
      this.socket.emit("board:leave", { boardId: this.roomId })
    }

    this.unbindEvents()
    this.socket.disconnect()
  }

  private bindEvents(): void {
    this.socket.on("connect", this.handleConnect)
    this.socket.on("disconnect", this.handleDisconnect)
    this.socket.on("connect_error", this.handleConnectError)
    this.socket.on("board:state", this.handleRoomState)
    this.socket.on("presence:update", this.handlePresenceUpdate)
    this.socket.on("cursor:updated", this.handleCursorUpdated)
    this.socket.on("object:editing", this.handleObjectEditing)
    this.socket.on("object:transform-previewed", this.handleTransformPreviewed)
    this.socket.on("operation:applied", this.handleOperationApplied)
    this.socket.on("operation:rejected", this.handleOperationRejected)
    this.socket.on("sync:response", this.handleSyncResponse)
    this.socket.on("error", this.handleSocketError)
  }

  private unbindEvents(): void {
    this.socket.off("connect", this.handleConnect)
    this.socket.off("disconnect", this.handleDisconnect)
    this.socket.off("connect_error", this.handleConnectError)
    this.socket.off("board:state", this.handleRoomState)
    this.socket.off("presence:update", this.handlePresenceUpdate)
    this.socket.off("cursor:updated", this.handleCursorUpdated)
    this.socket.off("object:editing", this.handleObjectEditing)
    this.socket.off("object:transform-previewed", this.handleTransformPreviewed)
    this.socket.off("operation:applied", this.handleOperationApplied)
    this.socket.off("operation:rejected", this.handleOperationRejected)
    this.socket.off("sync:response", this.handleSyncResponse)
    this.socket.off("error", this.handleSocketError)
  }

  private handleConnect = () => {
    this.actions.setSocketError(null)

    if (this.hasLoadedInitialRoomState) {
      this.isSyncing = true
      this.bufferedOperations.length = 0
      this.socket.emit("sync:request", {
        boardId: this.roomId,
        lastSeenRevision: this.actions.getLastSeenRevision(),
      })
      return
    }

    this.socket.emit("board:join", { boardId: this.roomId })
  }

  private handleDisconnect = () => {
    this.actions.setConnectionStatus(this.socket.active ? "reconnecting" : "disconnected")
  }

  private handleConnectError = (error: Error) => {
    this.actions.setConnectionStatus(this.socket.active ? "reconnecting" : "disconnected")
    this.actions.setSocketError(error.message || "Socket connection failed.")
  }

  private handleRoomState = (event: RoomStateEvent) => {
    if (event.board.id !== this.roomId) {
      return
    }

    this.hasLoadedInitialRoomState = true
    this.isSyncing = false
    this.bufferedOperations.length = 0
    this.actions.setLoadedRoomState({
      room: event.board,
      currentUser: event.currentUser,
      currentRevision: event.board.currentRevision,
      objects: event.objects,
      onlineUsers: event.onlineUsers,
    })
  }

  private handlePresenceUpdate = (event: PresenceUpdateEvent) => {
    if (event.boardId !== this.roomId) {
      return
    }

    this.actions.setOnlineUsers(event.onlineUsers)
  }

  private handleSocketError = (event: SocketErrorEvent) => {
    if (this.isSyncing) {
      this.isSyncing = false
      this.bufferedOperations.length = 0

      if (this.socket.connected) {
        this.socket.emit("board:join", { boardId: this.roomId })
      }
    }

    this.actions.setSocketError(event.message)
  }

  private handleTransformPreviewed = (event: ObjectTransformPreviewedEvent) => {
    if (event.boardId !== this.roomId) {
      return
    }

    this.actions.applyRemoteTransformPreview(event)
  }

  private handleCursorUpdated = (event: CursorUpdatedEvent) => {
    if (event.boardId !== this.roomId) {
      return
    }

    this.actions.applyRemoteCursor(event)
  }

  private handleObjectEditing = (event: ObjectEditingEvent) => {
    if (event.boardId !== this.roomId) {
      return
    }

    this.actions.applyRemoteEditing(event)
  }

  private handleOperationApplied = (event: OperationAppliedEvent) => {
    if (event.boardId !== this.roomId) {
      return
    }

    if (this.isSyncing) {
      this.bufferedOperations.push(event)
      return
    }

    this.applyAcceptedOperation(event)
  }

  private handleSyncResponse = (event: SyncResponse) => {
    if (event.boardId !== this.roomId) {
      return
    }

    if (event.mode === "FULL_STATE") {
      this.isSyncing = false
      this.bufferedOperations.length = 0
      this.actions.setObjectsWithRevision(event.objects, event.revision)
      this.actions.setConnectionStatus("connected")
      return
    }

    for (const operation of this.sortOperationsByRevision(event.operations)) {
      this.applyAcceptedOperation(operation)
    }

    this.actions.markRevisionSynced(event.toRevision)

    const operationsBufferedDuringSync =
      this.sortOperationsByRevision(this.bufferedOperations)
    this.bufferedOperations.length = 0
    this.isSyncing = false

    for (const operation of operationsBufferedDuringSync) {
      this.applyAcceptedOperation(operation)
    }

    this.actions.setConnectionStatus("connected")
  }

  private handleOperationRejected = (event: OperationRejectedEvent) => {
    if (event.boardId !== this.roomId) {
      return
    }

    const pendingOperation = this.pendingOperations.get(event.clientOpId)

    this.pendingOperations.delete(event.clientOpId)

    if (pendingOperation) {
      pendingOperation.reject(event)
      return
    }

    this.actions.applyOperationRejection(event)
  }

  private applyAcceptedOperation(event: OperationAppliedEvent) {
    const pendingOperation = this.pendingOperations.get(event.clientOpId)

    this.pendingOperations.delete(event.clientOpId)
    this.actions.applyOperation(event, {
      removeObjectId: pendingOperation?.tempObjectId,
      historyCandidate: pendingOperation?.historyCandidate,
    })
    pendingOperation?.resolve(event)
  }

  private sortOperationsByRevision(
    operations: OperationAppliedEvent[],
  ): OperationAppliedEvent[] {
    return [...operations].sort((left, right) => left.revision - right.revision)
  }

  private emitObjectOperation(
    emitOperation: () => void,
    request: { clientOpId: string; boardId: string },
    options?: WhiteboardOperationSenderOptions,
  ): Promise<OperationAppliedEvent> {
    return new Promise((resolve, reject) => {
      if (request.boardId !== this.roomId) {
        reject(new Error("Object operation targets a different room."))
        return
      }

      if (!this.socket.connected) {
        reject(new Error("Realtime connection is not ready."))
        return
      }

      this.pendingOperations.set(request.clientOpId, {
        resolve,
        reject,
        tempObjectId: options?.tempObjectId,
        historyCandidate: options?.historyCandidate,
      })
      emitOperation()
    })
  }

  public createOperationSender(): WhiteboardOperationSender {
    return {
      createObject: (request, options) =>
        this.emitObjectOperation(
          () => this.socket.emit("object:create", request),
          request,
          options,
        ),
      updateObject: (request, options) =>
        this.emitObjectOperation(
          () => this.socket.emit("object:update", request),
          request,
          options,
        ),
      deleteObject: (request, options) =>
        this.emitObjectOperation(
          () => this.socket.emit("object:delete", request),
          request,
          options,
        ),
      undoOperation: (request) =>
        this.emitObjectOperation(() => this.socket.emit("undo:request", request), request),
      redoOperation: (request) =>
        this.emitObjectOperation(() => this.socket.emit("redo:request", request), request),
    }
  }

  public createTransformPreviewSender(): WhiteboardTransformPreviewSender {
    return {
      sendPreview: (request) => {
        if (request.boardId !== this.roomId || !this.socket.connected) {
          return
        }

        this.socket.emit("object:transform-preview", request)
      },
    }
  }

  public createCursorSender(): WhiteboardCursorSender {
    return {
      sendCursorUpdate: (request) => {
        if (request.boardId !== this.roomId || !this.socket.connected) {
          return
        }

        this.socket.emit("cursor:update", request)
      },
    }
  }

  public createEditingSender(): WhiteboardEditingSender {
    return {
      startEditing: (request) => {
        if (request.boardId !== this.roomId || !this.socket.connected) {
          return
        }

        this.socket.emit("editing:start", request)
      },
      endEditing: (request) => {
        if (request.boardId !== this.roomId || !this.socket.connected) {
          return
        }

        this.socket.emit("editing:end", request)
      },
    }
  }

  public createSelectionSender(): WhiteboardSelectionSender {
    return {
      sendSelectionUpdate: (request) => {
        if (request.boardId !== this.roomId || !this.socket.connected) {
          return
        }

        this.socket.emit("selection:update", request)
      },
    }
  }
}
