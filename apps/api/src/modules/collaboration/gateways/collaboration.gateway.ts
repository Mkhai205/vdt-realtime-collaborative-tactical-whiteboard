import { Logger, UnauthorizedException } from "@nestjs/common"
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets"
import type { UserSummary } from "@rctw/shared-contracts"
import type { Server, Socket } from "socket.io"
import {
  BoardSessionHandler,
  CollaborationHandler,
  WhiteboardMutationHandler,
} from "../handlers"
import { PresenceService } from "../presence.service"
import { AuthService } from "../../auth/auth.service"

import { ConfigService } from "@nestjs/config"

type CollaborationSocketData = {
  currentUser?: UserSummary
}

export type CollaborationSocket = Socket & {
  data: CollaborationSocketData
}

@WebSocketGateway({ cors: false })
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(CollaborationGateway.name)

  @WebSocketServer()
  private server!: Server

  constructor(
    private readonly presenceService: PresenceService,
    private readonly boardSessionHandler: BoardSessionHandler,
    private readonly whiteboardMutationHandler: WhiteboardMutationHandler,
    private readonly collaborationHandler: CollaborationHandler,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────

  afterInit(server: Server): void {
    this.logger.log("Collaboration Gateway initialized")
  }

  async handleConnection(client: CollaborationSocket): Promise<void> {
    try {
      const accessToken = client.handshake.auth.token as string

      client.data.currentUser =
        await this.authService.verifyAccessToken(accessToken)
    } catch (error) {
      this.logger.warn("Socket auth failed", error)
      client.emit("error", {
        code: "UNAUTHENTICATED",
        message: "Socket identity is required.",
      })
      client.disconnect(true)
    }
  }

  handleDisconnect(client: CollaborationSocket): void {
    const endedEditingStates = this.presenceService.clearEditingForSocket(
      client.id,
    )
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
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.boardSessionHandler.handleJoin(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("board:leave")
  handleBoardLeave(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    return this.boardSessionHandler.handleLeave(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("sync:request")
  handleSyncRequest(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.boardSessionHandler.handleSync(
      { server: this.server, client },
      payload,
    )
  }

  // ── Whiteboard mutation events ─────────────────────────────────────────

  @SubscribeMessage("object:create")
  handleObjectCreate(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.whiteboardMutationHandler.handleObjectCreate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("object:update")
  handleObjectUpdate(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.whiteboardMutationHandler.handleObjectUpdate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("object:delete")
  handleObjectDelete(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.whiteboardMutationHandler.handleObjectDelete(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("undo:request")
  handleUndoRequest(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.whiteboardMutationHandler.handleUndoRequest(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("redo:request")
  handleRedoRequest(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    this.requireCurrentUser(client)
    return this.whiteboardMutationHandler.handleRedoRequest(
      { server: this.server, client },
      payload,
    )
  }

  // ── Collaboration events ───────────────────────────────────────────────

  @SubscribeMessage("editing:start")
  handleEditingStart(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleEditingStart(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("editing:end")
  handleEditingEnd(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleEditingEnd(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("cursor:update")
  handleCursorUpdate(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleCursorUpdate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("selection:update")
  handleSelectionUpdate(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleSelectionUpdate(
      { server: this.server, client },
      payload,
    )
  }

  @SubscribeMessage("object:transform-preview")
  handleObjectTransformPreview(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() payload: unknown,
  ): void {
    this.collaborationHandler.handleTransformPreview(
      { server: this.server, client },
      payload,
    )
  }

  // ── Private guards ─────────────────────────────────────────────────────

  private requireCurrentUser(client: CollaborationSocket): UserSummary {
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
