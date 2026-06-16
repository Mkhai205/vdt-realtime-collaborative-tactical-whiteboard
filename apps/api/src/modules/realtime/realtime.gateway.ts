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
import type { UserSummary } from "@rctw/shared-contracts"
import type { Server, Socket } from "socket.io"
import { AuthService } from "../auth/services/auth.service"
import {
  BoardSessionHandler,
  CollaborationHandler,
  WhiteboardMutationHandler,
} from "./handlers"
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
    private readonly authService: AuthService,
    private readonly presenceService: PresenceService,
    private readonly boardSessionHandler: BoardSessionHandler,
    private readonly whiteboardMutationHandler: WhiteboardMutationHandler,
    private readonly collaborationHandler: CollaborationHandler,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async handleConnection(client: RealtimeSocket): Promise<void> {
    try {
      client.data.currentUser =
        await this.authService.resolveSocketIdentity(client.handshake.auth)
    } catch (error) {
      this.logger.warn("Socket auth failed", error)
      client.emit("error", {
        code: "UNAUTHENTICATED",
        message: "Socket identity is required.",
      })
      client.disconnect(true)
    }
  }

  handleDisconnect(client: RealtimeSocket): void {
    const endedEditingStates = this.presenceService.clearEditingForSocket(client.id)
    const affectedBoardIds = this.presenceService.leaveAllBoards(client.id)

    this.boardSessionHandler.emitEndedEditingStates(
      this.server,
      endedEditingStates,
      client.id,
    )

    for (const boardId of affectedBoardIds) {
      this.boardSessionHandler.emitPresenceUpdate(this.server, boardId)
    }
  }

  // ── Session events ─────────────────────────────────────────────────────

  @SubscribeMessage("board:join")
  handleBoardJoin(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.boardSessionHandler.handleJoin({ server: this.server, client }, payload)
  }

  @SubscribeMessage("board:leave")
  handleBoardLeave(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.boardSessionHandler.handleLeave({ server: this.server, client }, payload)
  }

  @SubscribeMessage("sync:request")
  handleSyncRequest(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.boardSessionHandler.handleSync({ server: this.server, client }, payload)
  }

  // ── Whiteboard mutation events ─────────────────────────────────────────

  @SubscribeMessage("object:create")
  handleObjectCreate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.whiteboardMutationHandler.handleObjectCreate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("object:update")
  handleObjectUpdate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.whiteboardMutationHandler.handleObjectUpdate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("object:delete")
  handleObjectDelete(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.whiteboardMutationHandler.handleObjectDelete(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("undo:request")
  handleUndoRequest(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.whiteboardMutationHandler.handleUndoRequest(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("redo:request")
  handleRedoRequest(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.whiteboardMutationHandler.handleRedoRequest(
      { server: this.server, client },
      payload,
    )
  }

  // ── Collaboration events ───────────────────────────────────────────────

  @SubscribeMessage("editing:start")
  handleEditingStart(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleEditingStart({ server: this.server, client }, payload)
  }

  @SubscribeMessage("editing:end")
  handleEditingEnd(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleEditingEnd({ server: this.server, client }, payload)
  }

  @SubscribeMessage("cursor:update")
  handleCursorUpdate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleCursorUpdate({ server: this.server, client }, payload)
  }

  @SubscribeMessage("selection:update")
  handleSelectionUpdate(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleSelectionUpdate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("object:transform-preview")
  handleObjectTransformPreview(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleTransformPreview(
      { server: this.server, client },
      payload,
    )
  }

  // ── Private guards ─────────────────────────────────────────────────────

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
}
