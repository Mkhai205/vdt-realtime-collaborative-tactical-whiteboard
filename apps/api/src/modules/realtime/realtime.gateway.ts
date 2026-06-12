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
  cursorUpdateRequestSchema,
  editingEndRequestSchema,
  editingStartRequestSchema,
  objectTransformPreviewRequestSchema,
  objectCreateSocketRequestSchema,
  objectDeleteSocketRequestSchema,
  objectUpdateSocketRequestSchema,
  redoRequestSchema,
  roomJoinRequestSchema,
  roomLeaveRequestSchema,
  selectionUpdateRequestSchema,
  syncRequestSchema,
  toRoomSocketName,
  undoRequestSchema,
  type CursorUpdatedEvent,
  type ObjectEditingEvent,
  type OperationAppliedEvent,
  type OperationRejectedEvent,
  type RoomStateEvent,
  type RoomRole,
  type SocketErrorEvent,
  type SyncResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import type { Server, Socket } from "socket.io"
import { z } from "zod"
import { IdentityService } from "../identity"
import { RoomsService } from "../rooms"
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
    private readonly identityService: IdentityService,
    private readonly roomsService: RoomsService,
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(client: RealtimeSocket): Promise<void> {
    try {
      client.data.currentUser =
        await this.identityService.resolveSocketIdentity(client.handshake.auth)
    } catch (error) {
      client.emit("error", this.toSocketError(error))
      client.disconnect(true)
    }
  }

  handleDisconnect(client: RealtimeSocket): void {
    const endedEditingStates = this.presenceService.clearEditingForSocket(
      client.id,
    )
    const affectedRoomIds = this.presenceService.leaveAllRooms(client.id)

    this.emitEndedEditingStates(endedEditingStates, client.id)

    for (const roomId of affectedRoomIds) {
      this.emitPresenceUpdate(roomId)
    }
  }

  @SubscribeMessage("room:join")
  async handleRoomJoin(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = roomJoinRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { roomId } = parsed.data

    try {
      const currentUser = this.requireCurrentUser(client)
      const joinResponse = await this.roomsService.joinRoom(currentUser, roomId)
      const objectsResponse =
        await this.whiteboardObjectsService.getRoomObjects(currentUser, roomId)

      await client.join(toRoomSocketName(roomId))

      const onlineUsers = this.presenceService.joinRoom({
        socketId: client.id,
        roomId,
        user: currentUser,
        role: joinResponse.currentUser.role,
      })
      const roomState: RoomStateEvent = {
        room: {
          id: joinResponse.room.id,
          name: joinResponse.room.name,
          description: joinResponse.room.description ?? null,
          currentRevision: objectsResponse.currentRevision,
          isPublic: joinResponse.room.isPublic,
          defaultJoinRole: joinResponse.room.defaultJoinRole,
        },
        currentUser: joinResponse.currentUser,
        objects: objectsResponse.objects,
        onlineUsers,
      }

      client.emit("room:state", roomState)
      this.emitPresenceUpdate(roomId)
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  @SubscribeMessage("room:leave")
  async handleRoomLeave(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = roomLeaveRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { roomId } = parsed.data

    const endedEditingStates = this.presenceService.clearEditingForSocketRoom(
      client.id,
      roomId,
    )

    await client.leave(toRoomSocketName(roomId))
    this.presenceService.leaveRoom(client.id, roomId)
    this.emitEndedEditingStates(endedEditingStates, client.id)
    this.emitPresenceUpdate(roomId)
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

    const { roomId, lastSeenRevision } = parsed.data

    try {
      const currentUser = this.requireCurrentUser(client)
      const joinResponse = await this.roomsService.joinRoom(currentUser, roomId)

      await client.join(toRoomSocketName(roomId))
      this.presenceService.joinRoom({
        socketId: client.id,
        roomId,
        user: currentUser,
        role: joinResponse.currentUser.role,
      })

      const response: SyncResponse =
        await this.whiteboardObjectsService.getRoomOperationReplay(
          currentUser,
          roomId,
          lastSeenRevision,
        )

      client.emit("sync:response", response)
      this.emitPresenceUpdate(roomId)
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
      const { roomId, objectId } = parsed.data

      if (
        !this.getEditableRoomRole(client, roomId, {
          notInRoom: "Join the room before announcing editing state.",
          permissionDenied:
            "Only room owners and editors can announce editing state.",
        })
      ) {
        return
      }

      this.presenceService.startEditing({
        socketId: client.id,
        roomId,
        objectId,
      })
      this.emitEditingEvent({
        roomId,
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
      const { roomId, objectId } = parsed.data

      if (
        !this.getEditableRoomRole(client, roomId, {
          notInRoom: "Join the room before announcing editing state.",
          permissionDenied:
            "Only room owners and editors can announce editing state.",
        })
      ) {
        return
      }

      this.presenceService.endEditing({
        socketId: client.id,
        roomId,
        objectId,
      })
      this.emitEditingEvent({
        roomId,
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

    const { roomId, ...request } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.createObject(currentUser, roomId, request),
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

    const { roomId, objectId, ...request } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.updateObject(
        currentUser,
        roomId,
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

    const { roomId, objectId, ...request } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.deleteObject(
        currentUser,
        roomId,
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

    const { roomId, clientOpId, inverseOperation } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      processUndoRedoOperation(
        this.whiteboardObjectsService,
        currentUser,
        roomId,
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

    const { roomId, clientOpId, redoOperation } = parsed.data

    await this.processObjectOperation(client, parsed.data, (currentUser) =>
      processUndoRedoOperation(
        this.whiteboardObjectsService,
        currentUser,
        roomId,
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
      const { roomId, objectId, preview } = parsed.data

      if (
        !this.getEditableRoomRole(client, roomId, {
          notInRoom: "Join the room before sending transform previews.",
          permissionDenied:
            "Only room owners and editors can preview transforms.",
        })
      ) {
        return
      }

      this.server
        .to(toRoomSocketName(roomId))
        .except(client.id)
        .emit("object:transform-previewed", {
          roomId,
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
      const { roomId } = parsed.data

      if (!this.presenceService.hasSocketInRoom(client.id, roomId)) {
        client.emit("error", {
          code: "USER_NOT_IN_ROOM",
          message: "Join the room before sending cursor updates.",
        })
        return
      }

      const event: CursorUpdatedEvent = {
        ...parsed.data,
        user: currentUser,
        timestamp: new Date().toISOString(),
      }

      this.server
        .to(toRoomSocketName(roomId))
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

      const { roomId, selectedObjectId } = parsed.data
      const onlineUsers = this.presenceService.updateSelectedObject({
        socketId: client.id,
        roomId,
        selectedObjectId,
      })

      if (!onlineUsers) {
        client.emit("error", {
          code: "USER_NOT_IN_ROOM",
          message: "Join the room before sending selection updates.",
        })
        return
      }

      this.server.to(toRoomSocketName(roomId)).emit("presence:update", {
        roomId,
        onlineUsers,
      })
    } catch (error) {
      client.emit("error", this.toSocketError(error))
    }
  }

  private emitPresenceUpdate(roomId: string): void {
    this.server.to(toRoomSocketName(roomId)).emit("presence:update", {
      roomId,
      onlineUsers: this.presenceService.getOnlineUsers(roomId),
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
    const emitter = this.server.to(toRoomSocketName(input.roomId))

    if (exceptSocketId) {
      emitter.except(exceptSocketId).emit("object:editing", event)
      return
    }

    emitter.emit("object:editing", event)
  }

  private emitEndedEditingStates(
    states: Array<{ roomId: string; objectId: string; user: UserSummary }>,
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

  private canEditObjects(role: RoomRole): boolean {
    return role === "OWNER" || role === "EDITOR"
  }

  private getEditableRoomRole(
    client: RealtimeSocket,
    roomId: string,
    messages: {
      notInRoom: string
      permissionDenied: string
    },
  ): RoomRole | null {
    const role = this.presenceService.getSocketRoomRole(client.id, roomId)

    if (!role) {
      client.emit("error", {
        code: "USER_NOT_IN_ROOM",
        message: messages.notInRoom,
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

      if (!this.presenceService.hasSocketInRoom(client.id, context.roomId)) {
        client.emit(
          "operation:rejected",
          operationRejected(context, {
            reason: "USER_NOT_IN_ROOM",
            message: "Join the room before sending object operations.",
          }),
        )
        return
      }

      const operation = await persistOperation(currentUser)

      this.server
        .to(toRoomSocketName(context.roomId))
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
