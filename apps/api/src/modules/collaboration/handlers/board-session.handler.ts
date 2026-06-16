import { Injectable } from "@nestjs/common"
import {
  boardJoinRequestSchema,
  boardLeaveRequestSchema,
  syncRequestSchema,
  toBoardSocketName,
  type BoardStateEvent,
  type SyncResponse,
} from "@rctw/shared-contracts"
import { BoardService } from "../../board/services/board.service"
import { WhiteboardObjectsService } from "../../whiteboard"
import { PresenceService } from "../../presence"
import type { CollaborationContext } from "../collaboration-context"
import {
  toSocketError,
  toValidationSocketError,
} from "../collaboration-socket-errors"

@Injectable()
export class BoardSessionHandler {
  constructor(
    private readonly boardService: BoardService,
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleJoin(
    { server, client }: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = boardJoinRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { boardId } = parsed.data

    try {
      const currentUser = client.data.currentUser!
      const joinResponse = await this.boardService.joinBoard(
        currentUser,
        boardId,
      )
      const objectsResponse =
        await this.whiteboardObjectsService.getBoardObjects(
          currentUser,
          boardId,
        )

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
      this.emitPresenceUpdate(server, boardId)
    } catch (error) {
      client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  async handleLeave(
    { server, client }: CollaborationContext,
    payload: unknown,
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
    this.emitEndedEditingStates(server, endedEditingStates, client.id)
    this.emitPresenceUpdate(server, boardId)
  }

  async handleSync(
    { server, client }: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = syncRequestSchema.safeParse(payload)

    if (!parsed.success) {
      client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    const { boardId, lastSeenRevision } = parsed.data

    try {
      const currentUser = client.data.currentUser!
      const joinResponse = await this.boardService.joinBoard(
        currentUser,
        boardId,
      )

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
      this.emitPresenceUpdate(server, boardId)
    } catch (error) {
      client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  // ── Shared emit helpers ────────────────────────────────────────────────

  emitPresenceUpdate(
    server: import("socket.io").Server,
    boardId: string,
  ): void {
    server.to(toBoardSocketName(boardId)).emit("presence:update", {
      boardId,
      onlineUsers: this.presenceService.getOnlineUsers(boardId),
    })
  }

  emitEndedEditingStates(
    server: import("socket.io").Server,
    states: Array<{
      boardId: string
      objectId: string
      user: import("@rctw/shared-contracts").UserSummary
    }>,
    exceptSocketId?: string,
  ): void {
    for (const state of states) {
      const event = {
        ...state,
        status: "ENDED" as const,
        timestamp: new Date().toISOString(),
      }
      const emitter = server.to(toBoardSocketName(state.boardId))

      if (exceptSocketId) {
        emitter.except(exceptSocketId).emit("object:editing", event)
      } else {
        emitter.emit("object:editing", event)
      }
    }
  }

  private logError(message: string, error: unknown): void {
    // Surface to NestJS logger via gateway or suppress here
    void message
    void error
  }
}
