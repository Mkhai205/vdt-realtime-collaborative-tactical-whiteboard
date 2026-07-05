import { Logger, UseFilters, UseGuards } from "@nestjs/common"
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
import type { Server, Socket } from "socket.io"
import { WsAuthGuard } from "../guards/ws-auth.guard"
import { WsExceptionFilter } from "../../../common/filters"
import { AuthService } from "../../auth/auth.service"
import {
  BoardHandler,
  ObjectHandler,
  CursorHandler,
  OperationHandler,
  PresenceHandler,
  SelectionHandler,
} from "../handlers"
import {
  ClientEvents,
  type BoardJoinRequest,
  type BoardLeaveRequest,
  type SyncRequest,
  type ObjectCreateRequest,
  type ObjectUpdateRequest,
  type ObjectDeleteRequest,
  type CursorMoveRequest,
  type UndoRequest,
  type RedoRequest,
  type ObjectEditingRequest,
  type ObjectMoveEphemeralRequest,
} from "@rctw/shared-contracts"

@WebSocketGateway({
  namespace: "/boards",
  cors: {
    origin: true,
    credentials: true,
  },
})
@UseGuards(WsAuthGuard)
@UseFilters(WsExceptionFilter)
export class BoardGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(BoardGateway.name)

  @WebSocketServer()
  private server!: Server

  constructor(
    private readonly boardHandler: BoardHandler,
    private readonly objectHandler: ObjectHandler,
    private readonly cursorHandler: CursorHandler,
    private readonly operationHandler: OperationHandler,
    private readonly presenceHandler: PresenceHandler,
    private readonly selectionHandler: SelectionHandler,
    private readonly authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log("BoardGateway initialized")
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader: string =
        client.handshake.auth?.token || client.handshake.headers?.authorization
      if (authHeader) {
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.substring(7)
          : authHeader
        if (token) {
          const payload = await this.authService.verifyAccessToken(token)
          client.data.currentUser = payload
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Auth failed on connection for client ${client.id}: ${err.message}`,
      )
    }
    await this.presenceHandler.handleConnection(client)
  }

  async handleDisconnect(client: Socket) {
    await this.presenceHandler.handleDisconnect(client)
  }

  // --- Board ---

  @SubscribeMessage(ClientEvents.BOARD_JOIN)
  async joinBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: BoardJoinRequest,
  ) {
    return this.boardHandler.join(client, dto)
  }

  @SubscribeMessage(ClientEvents.BOARD_LEAVE)
  async leaveBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: BoardLeaveRequest,
  ) {
    return this.boardHandler.leave(client, dto)
  }

  @SubscribeMessage(ClientEvents.BOARD_SYNC)
  async syncBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SyncRequest,
  ) {
    return this.boardHandler.sync(client, dto)
  }

  // --- Objects ---

  @SubscribeMessage(ClientEvents.OBJECT_CREATE)
  async createObject(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ObjectCreateRequest,
  ) {
    return this.objectHandler.create(client, dto)
  }

  @SubscribeMessage(ClientEvents.OBJECT_UPDATE)
  async updateObject(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ObjectUpdateRequest,
  ) {
    return this.objectHandler.update(client, dto)
  }

  @SubscribeMessage(ClientEvents.OBJECT_DELETE)
  async deleteObject(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ObjectDeleteRequest,
  ) {
    return this.objectHandler.delete(client, dto)
  }

  // --- History ---

  @SubscribeMessage(ClientEvents.OPERATION_UNDO)
  async undo(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UndoRequest,
  ) {
    return this.operationHandler.undo(client, dto)
  }

  @SubscribeMessage(ClientEvents.OPERATION_REDO)
  async redo(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RedoRequest,
  ) {
    return this.operationHandler.redo(client, dto)
  }

  // --- Cursor & Awareness ---

  @SubscribeMessage(ClientEvents.CURSOR_MOVE)
  async moveCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CursorMoveRequest,
  ) {
    return this.cursorHandler.move(client, dto)
  }

  @SubscribeMessage(ClientEvents.OBJECT_EDITING)
  async objectEditing(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ObjectEditingRequest,
  ) {
    return this.selectionHandler.handleObjectEditing(client, dto)
  }


  @SubscribeMessage(ClientEvents.OBJECT_MOVE_EPHEMERAL)
  async moveObjectEphemeral(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ObjectMoveEphemeralRequest,
  ) {
    return this.objectHandler.moveEphemeral(client, dto)
  }
}
