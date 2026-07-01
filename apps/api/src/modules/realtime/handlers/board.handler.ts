import { Injectable, Logger } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type BoardStateEvent,
  type SyncResponse,
  type UserSummary,
  toBoardSocketName,
  ServerEvents,
  type BoardJoinRequest,
  type BoardLeaveRequest,
  type SyncRequest,
} from "@rctw/shared-contracts"
import { BoardService } from "../../board/service/board.service"
import { WhiteboardQueryService } from "../../board/service/board-operation.service"
import { PresenceService } from "../services/presence.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class BoardHandler {
  private readonly logger = new Logger(BoardHandler.name)

  constructor(
    private readonly boardService: BoardService,
    private readonly whiteboardQueryService: WhiteboardQueryService,
    private readonly presenceService: PresenceService,
  ) {}

  /**
   * Xử lý join board
   */
  async join(client: Socket, dto: BoardJoinRequest): Promise<void> {
    const { boardId } = dto

    try {
      const currentUser = client.data.currentUser as JwtPayload
      if (!currentUser) throw AppException.unauthenticated()

      const userSummary = toUserSummary(currentUser)

      // Kiểm tra quyền truy cập board
      const joinResponse = await this.boardService.getBoard(
        currentUser,
        boardId,
      )
      // Lấy danh sách objects hiện tại
      const objectsResponse = await this.whiteboardQueryService.getBoardObjects(
        currentUser,
        boardId,
      )

      // Join socket.io room
      const roomName = toBoardSocketName(boardId)
      await client.join(roomName)

      // Thêm vào presence store (Redis)
      const onlineUsers = await this.presenceService.joinBoard({
        socketId: client.id,
        boardId,
        user: userSummary,
        effectiveRole: joinResponse.effectiveRole,
      })

      const boardState: BoardStateEvent = {
        board: {
          id: joinResponse.id,
          name: joinResponse.name,
          description: joinResponse.description ?? null,
          currentRevision: objectsResponse.revision,
          visibility: joinResponse.visibility,
        },
        currentUser: {
          ...userSummary,
          effectiveRole: joinResponse.effectiveRole,
        },
        objects: objectsResponse.objects,
        onlineUsers,
      }

      // Gửi state cho client vừa join
      client.emit(ServerEvents.BOARD_STATE, boardState)

      // Broadcast update presence tới cả room
      this.emitPresenceUpdate(client, boardId, onlineUsers)
    } catch (error: any) {
      this.logger.error(`Join board error: ${error.message}`)
      client.emit(ServerEvents.ERROR, {
        code: error.response?.code || "UNEXPECTED_ERROR",
        message: error.message,
      })
    }
  }

  /**
   * Xử lý leave board
   */
  async leave(client: Socket, dto: BoardLeaveRequest): Promise<void> {
    const { boardId } = dto

    try {
      // Clear editing states trên board này
      const endedEditingStates =
        this.presenceService.clearEditingForSocketBoard(client.id, boardId)

      // Leave socket.io room
      const roomName = toBoardSocketName(boardId)
      await client.leave(roomName)

      // Xóa khỏi presence store
      await this.presenceService.leaveBoard(client.id, boardId)

      // Broadcast ended editing states
      this.emitEndedEditingStates(client, endedEditingStates, client.id)

      // Lấy online users mới để broadcast
      const onlineUsers = await this.presenceService.getOnlineUsers(boardId)
      this.emitPresenceUpdate(client, boardId, onlineUsers)
    } catch (error: any) {
      this.logger.error(`Leave board error: ${error.message}`)
      client.emit(ServerEvents.ERROR, {
        code: error.response?.code || "UNEXPECTED_ERROR",
        message: error.message,
      })
    }
  }

  /**
   * Xử lý sync (reconnect replay)
   */
  async sync(client: Socket, dto: SyncRequest): Promise<void> {
    const { boardId, lastSeenRevision } = dto

    try {
      const currentUser = client.data.currentUser as JwtPayload
      if (!currentUser) throw AppException.unauthenticated()

      const userSummary = toUserSummary(currentUser)

      // Kiểm tra quyền truy cập board
      const joinResponse = await this.boardService.getBoard(
        currentUser,
        boardId,
      )

      // Join socket.io room
      const roomName = toBoardSocketName(boardId)
      await client.join(roomName)

      const alreadyInBoard = await this.presenceService.hasSocketInBoard(
        client.id,
        boardId,
      )

      let onlineUsers: any[] = []
      if (!alreadyInBoard) {
        onlineUsers = await this.presenceService.joinBoard({
          socketId: client.id,
          boardId,
          user: userSummary,
          effectiveRole: joinResponse.effectiveRole,
        })
      } else {
        onlineUsers = await this.presenceService.getOnlineUsers(boardId)
      }

      // Replay operations từ revision đã biết
      // Mặc định lấy trang đầu tiên, limit 100 operations.
      // Nếu hasMore = true, client sẽ chủ động gửi sync tiếp.
      const replay = await this.whiteboardQueryService.getBoardOperationReplay(
        currentUser,
        boardId,
        { page: 1, limit: 100, fromRevision: lastSeenRevision },
      )

      const response: SyncResponse = {
        currentRevision: replay.latestRevision,
        operations: replay.operations,
        hasMore: replay.hasMore,
      }

      client.emit(ServerEvents.SYNC_RESPONSE, response)
      this.emitPresenceUpdate(client, boardId, onlineUsers)
    } catch (error: any) {
      this.logger.error(`Sync board error: ${error.message}`)
      client.emit(ServerEvents.ERROR, {
        code: error.response?.code || "UNEXPECTED_ERROR",
        message: error.message,
      })
    }
  }

  // ── Helpers ──

  private emitPresenceUpdate(
    client: Socket,
    boardId: string,
    onlineUsers: any[],
  ): void {
    client.nsp
      .to(toBoardSocketName(boardId))
      .emit(ServerEvents.PRESENCE_UPDATE, {
        boardId,
        onlineUsers,
      })
  }

  private emitEndedEditingStates(
    client: Socket,
    states: Array<{ boardId: string; objectId: string; user: UserSummary }>,
    exceptSocketId?: string,
  ): void {
    for (const state of states) {
      const event = {
        ...state,
        status: "ENDED" as const,
        timestamp: new Date().toISOString(),
      }
      const emitter = client.nsp.to(toBoardSocketName(state.boardId))

      if (exceptSocketId) {
        emitter.except(exceptSocketId).emit(ServerEvents.OBJECT_EDITING, event)
      } else {
        emitter.emit(ServerEvents.OBJECT_EDITING, event)
      }
    }
  }
}

function toUserSummary(currentUser: JwtPayload): UserSummary {
  return {
    id: currentUser.sub,
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl,
    avatarColor: currentUser.avatarColor,
  }
}
