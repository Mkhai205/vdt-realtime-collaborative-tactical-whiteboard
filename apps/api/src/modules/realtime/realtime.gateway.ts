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
  roomJoinRequestSchema,
  roomLeaveRequestSchema,
  toRoomSocketName,
  type RoomStateEvent,
  type SocketErrorEvent,
  type UserSummary,
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
    const affectedRoomIds = this.presenceService.leaveAllRooms(client.id)

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

    await client.leave(toRoomSocketName(roomId))
    this.presenceService.leaveRoom(client.id, roomId)
    this.emitPresenceUpdate(roomId)
  }

  private emitPresenceUpdate(roomId: string): void {
    this.server.to(toRoomSocketName(roomId)).emit("presence:update", {
      roomId,
      onlineUsers: this.presenceService.getOnlineUsers(roomId),
    })
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
