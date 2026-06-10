import { Injectable } from "@nestjs/common"
import type { OnlineUser, RoomRole, UserSummary } from "@rctw/shared-contracts"

type PresenceSession = OnlineUser & {
  socketId: string
  selectedObjectUpdatedAt: number
}

@Injectable()
export class PresenceService {
  private readonly roomSessions = new Map<
    string,
    Map<string, PresenceSession>
  >()
  private readonly socketRooms = new Map<string, Set<string>>()

  joinRoom(input: {
    socketId: string
    roomId: string
    user: UserSummary
    role: RoomRole
  }): OnlineUser[] {
    const connectedAt = new Date().toISOString()
    const room = this.getOrCreateRoom(input.roomId)

    room.set(input.socketId, {
      ...input.user,
      socketId: input.socketId,
      role: input.role,
      status: "ONLINE",
      selectedObjectId: null,
      selectedObjectUpdatedAt: 0,
      connectedAt,
    })

    const rooms = this.socketRooms.get(input.socketId) ?? new Set<string>()
    rooms.add(input.roomId)
    this.socketRooms.set(input.socketId, rooms)

    return this.getOnlineUsers(input.roomId)
  }

  leaveRoom(socketId: string, roomId: string): OnlineUser[] {
    this.roomSessions.get(roomId)?.delete(socketId)
    this.socketRooms.get(socketId)?.delete(roomId)
    this.deleteEmptyRoom(roomId)
    this.deleteEmptySocket(socketId)

    return this.getOnlineUsers(roomId)
  }

  leaveAllRooms(socketId: string): string[] {
    const roomIds = [...(this.socketRooms.get(socketId) ?? [])]

    for (const roomId of roomIds) {
      this.roomSessions.get(roomId)?.delete(socketId)
      this.deleteEmptyRoom(roomId)
    }

    this.socketRooms.delete(socketId)

    return roomIds
  }

  getOnlineUsers(roomId: string): OnlineUser[] {
    const sessions = this.roomSessions.get(roomId)

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

  hasSocketInRoom(socketId: string, roomId: string): boolean {
    return this.socketRooms.get(socketId)?.has(roomId) ?? false
  }

  getSocketRoomRole(socketId: string, roomId: string): RoomRole | null {
    return this.roomSessions.get(roomId)?.get(socketId)?.role ?? null
  }

  updateSelectedObject(input: {
    socketId: string
    roomId: string
    selectedObjectId: string | null
  }): OnlineUser[] | null {
    const session = this.roomSessions.get(input.roomId)?.get(input.socketId)

    if (!session) {
      return null
    }

    session.selectedObjectId = input.selectedObjectId
    session.selectedObjectUpdatedAt = Date.now()

    return this.getOnlineUsers(input.roomId)
  }

  private getOrCreateRoom(roomId: string): Map<string, PresenceSession> {
    const existingRoom = this.roomSessions.get(roomId)

    if (existingRoom) {
      return existingRoom
    }

    const room = new Map<string, PresenceSession>()
    this.roomSessions.set(roomId, room)
    return room
  }

  private deleteEmptyRoom(roomId: string): void {
    if (this.roomSessions.get(roomId)?.size === 0) {
      this.roomSessions.delete(roomId)
    }
  }

  private deleteEmptySocket(socketId: string): void {
    if (this.socketRooms.get(socketId)?.size === 0) {
      this.socketRooms.delete(socketId)
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
      role: session.role,
      status: session.status,
      selectedObjectId: latestSelectionSession.selectedObjectId,
      connectedAt: session.connectedAt,
    }
  }
}
