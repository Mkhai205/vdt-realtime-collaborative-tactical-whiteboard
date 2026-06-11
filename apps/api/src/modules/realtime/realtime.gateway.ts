import {
  Logger,
  UnauthorizedException,
  type HttpException,
} from "@nestjs/common"
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
  clientOpIdSchema,
  cursorUpdateRequestSchema,
  editingEndRequestSchema,
  editingStartRequestSchema,
  objectTransformPreviewRequestSchema,
  objectCreateSocketRequestSchema,
  objectDeleteSocketRequestSchema,
  objectUpdateSocketRequestSchema,
  operationRejectedReasonSchema,
  roomJoinRequestSchema,
  roomLeaveRequestSchema,
  selectionUpdateRequestSchema,
  toRoomSocketName,
  whiteboardObjectSchema,
  type CursorUpdatedEvent,
  type ObjectEditingEvent,
  type OperationAppliedEvent,
  type OperationRejectedEvent,
  type OperationRejectedReason,
  type RoomStateEvent,
  type RoomRole,
  type SocketErrorEvent,
  type UserSummary,
  type WhiteboardObject,
} from "@rctw/shared-contracts"
import type { Server, Socket } from "socket.io"
import { z } from "zod"
import { IdentityService } from "../identity"
import { RoomsService } from "../rooms"
import { WhiteboardObjectsService } from "../whiteboard-objects"
import { PresenceService } from "./presence.service"

const socketCorsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

type RealtimeSocketData = {
  currentUser?: UserSummary
}

type OperationRejectionContext = {
  clientOpId: string
  roomId: string
}

export type RealtimeSocket = Socket & {
  data: RealtimeSocketData
}

const operationRejectionContextSchema = z.object({
  clientOpId: clientOpIdSchema,
  roomId: z.uuid(),
})

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
      client.emit("error", this.validationError(parsed.error))
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
      client.emit("error", this.validationError(parsed.error))
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

  @SubscribeMessage("editing:start")
  handleEditingStart(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = editingStartRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", this.validationError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { roomId, objectId } = parsed.data
      const role = this.presenceService.getSocketRoomRole(client.id, roomId)

      if (!role) {
        client.emit("error", {
          code: "USER_NOT_IN_ROOM",
          message: "Join the room before announcing editing state.",
        })
        return
      }

      if (!this.canEditObjects(role)) {
        client.emit("error", {
          code: "PERMISSION_DENIED",
          message: "Only room owners and editors can announce editing state.",
        })
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
      client.emit("error", this.validationError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { roomId, objectId } = parsed.data
      const role = this.presenceService.getSocketRoomRole(client.id, roomId)

      if (!role) {
        client.emit("error", {
          code: "USER_NOT_IN_ROOM",
          message: "Join the room before announcing editing state.",
        })
        return
      }

      if (!this.canEditObjects(role)) {
        client.emit("error", {
          code: "PERMISSION_DENIED",
          message: "Only room owners and editors can announce editing state.",
        })
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

  @SubscribeMessage("object:transform-preview")
  handleObjectTransformPreview(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = objectTransformPreviewRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", this.validationError(parsed.error))
      return
    }

    try {
      const currentUser = this.requireCurrentUser(client)
      const { roomId, objectId, preview } = parsed.data
      const role = this.presenceService.getSocketRoomRole(client.id, roomId)

      if (!role) {
        client.emit("error", {
          code: "USER_NOT_IN_ROOM",
          message: "Join the room before sending transform previews.",
        })
        return
      }

      if (!this.canEditObjects(role)) {
        client.emit("error", {
          code: "PERMISSION_DENIED",
          message: "Only room owners and editors can preview transforms.",
        })
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
      client.emit("error", this.validationError(parsed.error))
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
      client.emit("error", this.validationError(parsed.error))
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
          this.operationRejected(context, {
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
    const context = this.parseOperationRejectionContext(payload)

    if (!context) {
      client.emit("error", this.validationError(error))
      return
    }

    client.emit(
      "operation:rejected",
      this.operationRejected(context, {
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

  private validationError(error: z.ZodError): SocketErrorEvent {
    return {
      code: "VALIDATION_ERROR",
      message: "Invalid socket payload.",
      details: z.treeifyError(error),
    }
  }

  private toOperationRejectedEvent(
    error: unknown,
    context: OperationRejectionContext,
  ): OperationRejectedEvent {
    if (this.isHttpException(error)) {
      const response = error.getResponse()

      if (this.isErrorResponse(response)) {
        return this.operationRejected(context, {
          reason: this.toOperationRejectedReason(
            response.code,
            error.getStatus(),
          ),
          message: response.message,
          latestObject: this.latestObjectFromDetails(response.details),
          currentRoomRevision: this.currentRoomRevisionFromDetails(
            response.details,
          ),
        })
      }

      return this.operationRejected(context, {
        reason: this.toOperationRejectedReason(undefined, error.getStatus()),
        message: error.message,
      })
    }

    this.logger.error("Unexpected realtime operation error", error)

    return this.operationRejected(context, {
      reason: "INTERNAL_ERROR",
      message: "Unexpected realtime operation error.",
    })
  }

  private operationRejected(
    context: OperationRejectionContext,
    input: {
      reason: OperationRejectedReason
      message: string
      latestObject?: WhiteboardObject | null
      currentRoomRevision?: number
    },
  ): OperationRejectedEvent {
    return {
      clientOpId: context.clientOpId,
      roomId: context.roomId,
      reason: input.reason,
      message: input.message,
      latestObject: input.latestObject,
      currentRoomRevision: input.currentRoomRevision,
    }
  }

  private parseOperationRejectionContext(
    payload: unknown,
  ): OperationRejectionContext | null {
    const parsed = operationRejectionContextSchema.safeParse(payload)

    return parsed.success ? parsed.data : null
  }

  private toOperationRejectedReason(
    code: string | undefined,
    status: number,
  ): OperationRejectedReason {
    if (code && operationRejectedReasonSchema.safeParse(code).success) {
      return code as OperationRejectedReason
    }

    if (code === "VALIDATION_ERROR") {
      return "INVALID_OPERATION_PAYLOAD"
    }

    if (code === "UNAUTHENTICATED") {
      return "PERMISSION_DENIED"
    }

    switch (status) {
      case 400:
        return "INVALID_OPERATION_PAYLOAD"
      case 403:
      case 401:
        return "PERMISSION_DENIED"
      case 404:
        return "OBJECT_NOT_FOUND"
      default:
        return "INTERNAL_ERROR"
    }
  }

  private latestObjectFromDetails(
    details: unknown,
  ): WhiteboardObject | null | undefined {
    if (
      typeof details !== "object" ||
      details === null ||
      !("latestObject" in details)
    ) {
      return undefined
    }

    const parsed = whiteboardObjectSchema
      .nullable()
      .safeParse((details as { latestObject?: unknown }).latestObject)

    return parsed.success ? parsed.data : undefined
  }

  private currentRoomRevisionFromDetails(details: unknown): number | undefined {
    if (
      typeof details !== "object" ||
      details === null ||
      !("currentRoomRevision" in details)
    ) {
      return undefined
    }

    const revision = (details as { currentRoomRevision?: unknown })
      .currentRoomRevision

    if (typeof revision !== "number") {
      return undefined
    }

    return Number.isSafeInteger(revision) && revision >= 0
      ? revision
      : undefined
  }

  private toSocketError(error: unknown): SocketErrorEvent {
    if (this.isHttpException(error)) {
      const response = error.getResponse()

      if (this.isErrorResponse(response)) {
        return {
          code: response.code,
          message: response.message,
          details: response.details,
        }
      }

      return {
        code: this.codeForStatus(error.getStatus()),
        message: error.message,
      }
    }

    this.logger.error("Unexpected realtime error", error)

    return {
      code: "INTERNAL_ERROR",
      message: "Unexpected realtime server error.",
    }
  }

  private isHttpException(error: unknown): error is HttpException {
    return (
      typeof error === "object" &&
      error !== null &&
      "getStatus" in error &&
      "getResponse" in error
    )
  }

  private isErrorResponse(value: unknown): value is SocketErrorEvent {
    return (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      "message" in value &&
      typeof (value as { code?: unknown }).code === "string" &&
      typeof (value as { message?: unknown }).message === "string"
    )
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 401:
        return "UNAUTHENTICATED"
      case 403:
        return "PERMISSION_DENIED"
      case 404:
        return "ROOM_NOT_FOUND"
      case 400:
        return "VALIDATION_ERROR"
      default:
        return "INTERNAL_ERROR"
    }
  }
}
