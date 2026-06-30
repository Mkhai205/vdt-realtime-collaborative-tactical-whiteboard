import { Injectable } from "@nestjs/common"
import type {
  EffectiveBoardRole,
  OnlineUser,
  UserSummary,
} from "@rctw/shared-contracts"

type PresenceSession = OnlineUser & {
  socketId: string
  selectedObjectUpdatedAt: number
  activeEditingObjectIds: Set<string>
}

export type ActiveEditingState = {
  boardId: string
  objectId: string
  user: UserSummary
}

/**
 * TODO: Migrate to Redis for distributed presence.
 *
 * Currently, presence state is stored in-memory. This means that if the API is
 * scaled to multiple instances, presence will not sync across instances correctly.
 *
 * Migration path:
 * 1. Use Redis Hashes to store user session data (boardId:socketId -> PresenceSession).
 * 2. Use Redis Pub/Sub to emit `presence:update` and `object:editing` events across nodes.
 * 3. Use Socket.IO Redis Adapter to scale WebSocket rooms.
 */
@Injectable()
export class PresenceService {
  private readonly boardSessions = new Map<
    string,
    Map<string, PresenceSession>
  >()
  private readonly socketBoards = new Map<string, Set<string>>()

  joinBoard(input: {
    socketId: string
    boardId: string
    user: UserSummary
    effectiveRole: EffectiveBoardRole
  }): OnlineUser[] {
    const connectedAt = new Date().toISOString()
    const board = this.getOrCreateBoard(input.boardId)

    board.set(input.socketId, {
      ...input.user,
      socketId: input.socketId,
      effectiveRole: input.effectiveRole,
      status: "ONLINE",
      selectedObjectId: null,
      selectedObjectUpdatedAt: 0,
      activeEditingObjectIds: new Set<string>(),
      connectedAt,
    })

    const boards = this.socketBoards.get(input.socketId) ?? new Set<string>()
    boards.add(input.boardId)
    this.socketBoards.set(input.socketId, boards)

    return this.getOnlineUsers(input.boardId)
  }

  leaveBoard(socketId: string, boardId: string): OnlineUser[] {
    this.clearEditingForSocketBoard(socketId, boardId)
    this.boardSessions.get(boardId)?.delete(socketId)
    this.socketBoards.get(socketId)?.delete(boardId)
    this.deleteEmptyBoard(boardId)
    this.deleteEmptySocket(socketId)

    return this.getOnlineUsers(boardId)
  }

  leaveAllBoards(socketId: string): string[] {
    const boardIds = [...(this.socketBoards.get(socketId) ?? [])]

    for (const boardId of boardIds) {
      this.clearEditingForSocketBoard(socketId, boardId)
      this.boardSessions.get(boardId)?.delete(socketId)
      this.deleteEmptyBoard(boardId)
    }

    this.socketBoards.delete(socketId)

    return boardIds
  }

  getOnlineUsers(boardId: string): OnlineUser[] {
    const sessions = this.boardSessions.get(boardId)

    if (!sessions) {
      return []
    }

    const usersById = new Map<
      string,
      { baseSession: PresenceSession; latestSelectionSession: PresenceSession }
    >()

    for (const session of sessions.values()) {
      const existing = usersById.get(session.id)

      if (!existing) {
        usersById.set(session.id, {
          baseSession: session,
          latestSelectionSession: session,
        })
        continue
      }

      if (session.connectedAt < existing.baseSession.connectedAt) {
        existing.baseSession = session
      }

      if (
        session.selectedObjectUpdatedAt >
        existing.latestSelectionSession.selectedObjectUpdatedAt
      ) {
        existing.latestSelectionSession = session
      }
    }

    return [...usersById.values()]
      .map(({ baseSession, latestSelectionSession }) =>
        this.toOnlineUser(baseSession, latestSelectionSession),
      )
      .sort((left, right) => left.connectedAt.localeCompare(right.connectedAt))
  }

  hasSocketInBoard(socketId: string, boardId: string): boolean {
    return this.socketBoards.get(socketId)?.has(boardId) ?? false
  }

  getSocketBoardRole(
    socketId: string,
    boardId: string,
  ): EffectiveBoardRole | null {
    return this.boardSessions.get(boardId)?.get(socketId)?.effectiveRole ?? null
  }

  updateSelectedObject(input: {
    socketId: string
    boardId: string
    selectedObjectId: string | null
  }): OnlineUser[] | null {
    const session = this.boardSessions.get(input.boardId)?.get(input.socketId)

    if (!session) {
      return null
    }

    session.selectedObjectId = input.selectedObjectId
    session.selectedObjectUpdatedAt = Date.now()

    return this.getOnlineUsers(input.boardId)
  }

  isObjectLockedByOther(input: {
    socketId: string
    boardId: string
    objectId: string
  }): boolean {
    const sessions = this.boardSessions.get(input.boardId)

    if (!sessions) {
      return false
    }

    for (const [sId, session] of sessions.entries()) {
      if (
        sId !== input.socketId &&
        session.activeEditingObjectIds.has(input.objectId)
      ) {
        return true
      }
    }

    return false
  }

  startEditing(input: {
    socketId: string
    boardId: string
    objectId: string
  }): boolean {
    if (this.isObjectLockedByOther(input)) {
      return false
    }

    const session = this.boardSessions.get(input.boardId)?.get(input.socketId)

    if (!session) {
      return false
    }

    session.activeEditingObjectIds.add(input.objectId)
    return true
  }

  endEditing(input: {
    socketId: string
    boardId: string
    objectId: string
  }): boolean {
    const session = this.boardSessions.get(input.boardId)?.get(input.socketId)

    if (!session) {
      return false
    }

    session.activeEditingObjectIds.delete(input.objectId)
    return true
  }

  clearEditingForSocketBoard(
    socketId: string,
    boardId: string,
  ): ActiveEditingState[] {
    const session = this.boardSessions.get(boardId)?.get(socketId)

    if (!session || session.activeEditingObjectIds.size === 0) {
      return []
    }

    const states = [...session.activeEditingObjectIds].map((objectId) => ({
      boardId,
      objectId,
      user: this.toUserSummary(session),
    }))

    session.activeEditingObjectIds.clear()
    return states
  }

  clearEditingForSocket(socketId: string): ActiveEditingState[] {
    return [...(this.socketBoards.get(socketId) ?? [])].flatMap((boardId) =>
      this.clearEditingForSocketBoard(socketId, boardId),
    )
  }

  private getOrCreateBoard(boardId: string): Map<string, PresenceSession> {
    const existing = this.boardSessions.get(boardId)

    if (existing) {
      return existing
    }

    const board = new Map<string, PresenceSession>()
    this.boardSessions.set(boardId, board)
    return board
  }

  private deleteEmptyBoard(boardId: string): void {
    if (this.boardSessions.get(boardId)?.size === 0) {
      this.boardSessions.delete(boardId)
    }
  }

  private deleteEmptySocket(socketId: string): void {
    if (this.socketBoards.get(socketId)?.size === 0) {
      this.socketBoards.delete(socketId)
    }
  }

  private toOnlineUser(
    session: PresenceSession,
    latestSelectionSession = session,
  ): OnlineUser {
    return {
      id: session.id,
      name: session.name,
      avatarUrl: session.avatarUrl,
      avatarColor: session.avatarColor,
      effectiveRole: session.effectiveRole,
      status: session.status,
      selectedObjectId: latestSelectionSession.selectedObjectId,
      connectedAt: session.connectedAt,
    }
  }

  private toUserSummary(session: PresenceSession): UserSummary {
    return {
      id: session.id,
      name: session.name,
      avatarUrl: session.avatarUrl,
      avatarColor: session.avatarColor,
    }
  }
}
