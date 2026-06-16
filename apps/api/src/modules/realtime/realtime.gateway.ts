import { Logger, UnauthorizedException } from "@nestjs/common"
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets"
import {
  boardJoinRequestSchema,
  boardLeaveRequestSchema,
  cursorUpdateRequestSchema,
  editingEndRequestSchema,
  editingStartRequestSchema,
  objectCreateSocketRequestSchema,
  objectDeleteSocketRequestSchema,
  objectTransformPreviewRequestSchema,
  objectUpdateSocketRequestSchema,
  redoRequestSchema,
  selectionUpdateRequestSchema,
  syncRequestSchema,
  toBoardSocketName,
  undoRequestSchema,
  type BoardRole,
  type BoardStateEvent,
  type CursorUpdatedEvent,
  type ObjectEditingEvent,
  type OperationAppliedEvent,
  type OperationRejectedEvent,
  type SocketErrorEvent,
  type SyncResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import type { Server, Socket } from "socket.io"
import { z } from "zod"
import { AuthService } from "../auth/services/auth.service"
import { BoardService } from "../board/services/board.service"
import { WhiteboardObjectsService } from "../whiteboard-objects"
import { PresenceService } from "./presence.service"
import { processUndoRedoOperation } from "./realtime-operation-dispatcher"
import {
  operationRejected,
  parseOperationRejectionContext,
  toOperationRejectedEvent,
  toSocketError,
  toValidationSocketError,
  type OperationRejectionContext,
} from "./realtime-socket-errors"

const socketCorsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

type RealtimeSocketData = {
  currentUser?: UserSummary
}

export type RealtimeSocket = Socket & {
  data: RealtimeSocketData
}

@WebSocketGateway({
  cors: {
    origin: socketCorsOrigins,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name)

  @WebSocketServer()
  private server!: Server

  constructor(
    private readonly authService: AuthService,
    private readonly boardService: BoardService,
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(client: RealtimeSocket): Promise<void> {
    try {
      client.data.currentUser =
        await this.authService.resolveSocketIdentity(client.handshake.auth)
    } catch (error) {
      client.emit("error", this.toSocketError(error))
      client.disconnect(true)
    }
  }

  handleDisconnect(client: RealtimeSocket): void {
    const endedEditingStates = this.presenceService.clearEditingForSocket(
      client.id,
    )
    const affectedBoardIds = this.presenceService.leaveAllBoards(client.id)

    this.emitEndedEditingStates(endedEditingStates, client.id)

    for (const boardId of affectedBoardIds) {
      this.emitPresenceUpdate(boardId)
    }
  }

  @SubscribeMessage("board:join")
  async handleBoardJoin(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = boardJoinRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { boardId } = parsed.data

    try {
      const currentUser = this.requireCurrentUser(client)
      const joinResponse = await this.boardService.joinBoard(currentUser, boardId)
      const objectsResponse =
        await this.whiteboardObjectsService.getBoardObjects(currentUser, boardId)

      await client.join(toBoardSocketName(boardId))

      const onlineUsers = this.presenceService.joinBoard({
        socketId: client.id,
        boardId,
        user: currentUser,
        role: joinResponse.currentUser.role,
      })

      const boardState: BoardStateEvent = {
        board: {
          id: joinResponse.board.id,
          name: joinResponse.board.name,
          description: joinResponse.board.description ?? null,
          currentRevision: objectsResponse.currentRevision,
          isPublic: joinResponse.board.isPublic,
          defaultJoinRole: joinResponse.board.defaultJoinRole,
        },
        currentUser: joinResponse.currentUser,
        objects: objectsResponse.objects,
        onlineUsers,
      }

      client.emit("board:state", boardState)
      this.emitPresenceUpdate(boardId)
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("board:leave")
  async handleBoardLeave(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = boardLeaveRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { boardId } = parsed.data

    const endedEditingStates = this.presenceService.clearEditingForSocketBoard(
      client.id,
      boardId,
    )

    await client.leave(toBoardSocketName(boardId))
    this.presenceService.leaveBoard(client.id, boardId)
    this.emitEndedEditingStates(endedEditingStates, client.id)
    this.emitPresenceUpdate(boardId)
  }

  @SubscribeMessage("sync:request")
  async handleSyncRequest(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = syncRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { boardId, lastSeenRevision } = parsed.data

    try {
      const currentUser = this.requireCurrentUser(client)
      const joinResponse = await this.boardService.joinBoard(currentUser, boardId)

      await client.join(toBoardSocketName(boardId))
      this.presenceService.joinBoard({
        socketId: client.id,
        boardId,
        user: currentUser,
        role: joinResponse.currentUser.role,
      })

      const response: SyncResponse =
        await this.whiteboardObjectsService.getBoardOperationReplay(
          currentUser,
          boardId,
          lastSeenRevision,
        )

      client.emit("sync:response", response)
      this.emitPresenceUpdate(boardId)
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("editing:start")
  handleEditingStart(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = editingStartRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { boardId, objectId } = parsed.data

      if (
        !this.getEditableBoardRole(client, boardId, {
          notInBoard: "Join the board before announcing editing state.",
          permissionDenied:
            "Only board owners and editors can announce editing state.",
        })
      ) {
        return
      }

      this.presenceService.startEditing({
        socketId: client.id,
        boardId,
        objectId,
      })
      this.emitEditingEvent({
        boardId,
        objectId,
        user: currentUser,
        status: "STARTED",
        exceptSocketId: client.id,
      })
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("editing:end")
  handleEditingEnd(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = editingEndRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { boardId, objectId } = parsed.data

      if (
        !this.getEditableBoardRole(client, boardId, {
          notInBoard: "Join the board before announcing editing state.",
          permissionDenied:
            "Only board owners and editors can announce editing state.",
        })
      ) {
        return
      }

      this.presenceService.endEditing({
        socketId: client.id,
        boardId,
        objectId,
      })
      this.emitEditingEvent({
        boardId,
        objectId,
        user: currentUser,
        status: "ENDED",
        exceptSocketId: client.id,
      })
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("object:create")
  async handleObjectCreate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = objectCreateSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(client, payload, parsed.error)
      return
    }

    const { boardId, ...request } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.createObject(currentUser, boardId, request),
    )
  }

  @SubscribeMessage("object:update")
  async handleObjectUpdate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = objectUpdateSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(client, payload, parsed.error)
      return
    }

    const { boardId, objectId, ...request } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.updateObject(
        currentUser,
        boardId,
        objectId,
        request,
      ),
    )
  }

  @SubscribeMessage("object:delete")
  async handleObjectDelete(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = objectDeleteSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(client, payload, parsed.error)
      return
    }

    const { boardId, objectId, ...request } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.deleteObject(
        currentUser,
        boardId,
        objectId,
        request,
      ),
    )
  }

  @SubscribeMessage("undo:request")
  async handleUndoRequest(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = undoRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(client, payload, parsed.error)
      return
    }

    const { boardId, clientOpId, inverseOperation } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      processUndoRedoOperation(
        this.whiteboardObjectsService,
        currentUser,
        boardId,
        clientOpId,
        inverseOperation,
      ),
    )
  }

  @SubscribeMessage("redo:request")
  async handleRedoRequest(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = redoRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(client, payload, parsed.error)
      return
    }

    const { boardId, clientOpId, redoOperation } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      processUndoRedoOperation(
        this.whiteboardObjectsService,
        currentUser,
        boardId,
        clientOpId,
        redoOperation,
      ),
    )
  }

  @SubscribeMessage("object:transform-preview")
  handleObjectTransformPreview(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = objectTransformPreviewRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { boardId, objectId, preview } = parsed.data

      if (
        !this.getEditableBoardRole(client, boardId, {
          notInBoard: "Join the board before sending transform previews.",
          permissionDenied:
            "Only board owners and editors can preview transforms.",
        })
      ) {
        return
      }

      this.server
        .to(toBoardSocketName(boardId))
        .except(client.id)
        .emit("object:transform-previewed", {
          boardId,
          objectId,
          user: currentUser,
          preview,
          timestamp: new Date().toISOString(),
        })
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("cursor:update")
  handleCursorUpdate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = cursorUpdateRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { boardId } = parsed.data

      if (!this.presenceService.hasSocketInBoard(client.id, boardId)) {
        client.emit("error", {
          code: "USER_NOT_IN_BOARD",
          message: "Join the board before sending cursor updates.",
        })
        return
      }

      const event: CursorUpdatedEvent = {
        ...parsed.data,
        user: currentUser,
        timestamp: new Date().toISOString(),
      }

      this.server
        .to(toBoardSocketName(boardId))
        .except(client.id)
        .emit("cursor:updated", event)
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("selection:update")
  handleSelectionUpdate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = selectionUpdateRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      this.requireCurrentUser(client)

      const { boardId, selectedObjectId } = parsed.data
      const onlineUsers = this.presenceService.updateSelectedObject({
        socketId: client.id,
        boardId,
        selectedObjectId,
      })

      if (!onlineUsers) {
        client.emit("error", {
          code: "USER_NOT_IN_BOARD",
          message: "Join the board before sending selection updates.",
        })
        return
      }

      this.server.to(toBoardSocketName(boardId)).emit("presence:update", {
        boardId,
        onlineUsers,
      })
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  // ── Private emit helpers ───────────────────────────────────────────────

  private emitPresenceUpdate(boardId: string): void {
    this.server.to(toBoardSocketName(boardId)).emit("presence:update", {
      boardId,
      onlineUsers: this.presenceService.getOnlineUsers(boardId),
    })
  }

  private emitEditingEvent(
    input: Omit<ObjectEditingEvent, "timestamp"> & { exceptSocketId?: string },
  ): void {
    const { exceptSocketId, ...eventInput } = input
    const event: ObjectEditingEvent = {
      ...eventInput,
      timestamp: new Date().toISOString(),
    }
    const emitter = this.server.to(toBoardSocketName(input.boardId))

    if (exceptSocketId) {
      emitter.except(exceptSocketId).emit("object:editing", event)
      return
    }

    emitter.emit("object:editing", event)
  }

  private emitEndedEditingStates(
    states: Array<{ boardId: string; objectId: string; user: UserSummary }>,
    exceptSocketId?: string,
  ): void {
    for (const state of states) {
      this.emitEditingEvent({
        ...state,
        status: "ENDED",
        exceptSocketId,
      })
    }
  }

  // ── Private guard helpers ──────────────────────────────────────────────

  private canEditObjects(role: BoardRole): boolean {
    return role === "OWNER" || role === "EDITOR"
  }

  private getEditableBoardRole(
    client: RealtimeSocket,
    boardId: string,
    messages: {
      notInBoard: string
      permissionDenied: string
    },
  ): BoardRole | null {
    const role = this.presenceService.getSocketBoardRole(client.id, boardId)

    if (!role) {
      client.emit("error", {
        code: "USER_NOT_IN_BOARD",
        message: messages.notInBoard,
      })
      return null
    }

    if (!this.canEditObjects(role)) {
      client.emit("error", {
        code: "PERMISSION_DENIED",
        message: messages.permissionDenied,
      })
      return null
    }

    return role
  }

  private async processObjectOperation(
    client: RealtimeSocket,
    context: OperationRejectionContext,
    persistOperation: (
      currentUser: UserSummary,
    ) => Promise<OperationAppliedEvent>,
  ): Promise<void> {
    try {
      const currentUser = this.requireCurrentUser(client)

      if (!this.presenceService.hasSocketInBoard(client.id, context.boardId)) {
        client.emit(
          "operation:rejected",
          operationRejected(context, {
            reason: "USER_NOT_IN_BOARD",
            message: "Join the board before sending object operations.",
          }),
        )
        return
      }

      const operation = await persistOperation(currentUser)

      this.server
        .to(toBoardSocketName(context.boardId))
        .emit("operation:applied", operation)
    } catch (error) {
      client.emit(
        "operation:rejected",
        this.toOperationRejectedEvent(error, context),
      )
    }
  }

  private emitInvalidOperationPayload(
    client: RealtimeSocket,
    payload: unknown,
    error: z.ZodError,
  ): void {
    const context = parseOperationRejectionContext(payload)

    if (!context) {
      client.emit("error", toValidationSocketError(error))
      return
    }

    client.emit(
      "operation:rejected",
      operationRejected(context, {
        reason: "INVALID_OPERATION_PAYLOAD",
        message: "Invalid object operation payload.",
      }),
    )
  }

  private requireCurrentUser(client: RealtimeSocket): UserSummary {
    const currentUser = client.data.currentUser

    if (!currentUser) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Socket identity is required.",
      })
    }

    return currentUser
  }

  private toOperationRejectedEvent(
    error: unknown,
    context: OperationRejectionContext,
  ): OperationRejectedEvent {
    return toOperationRejectedEvent(error, context, (message, cause) =>
      this.logUnexpectedError(message, cause),
    )
  }

  private toSocketError(error: unknown): SocketErrorEvent {
    return toSocketError(error, (message, cause) =>
      this.logUnexpectedError(message, cause),
    )
  }

  private logUnexpectedError(message: string, cause: unknown): void {
    this.logger.error(message, cause instanceof Error ? cause.stack : undefined)
  }
}
