import { Injectable } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type LaserMovedEvent,
  type LaserMoveRequest,
  avatarPalette,
  toBoardSocketName,
  ServerEvents,
} from "@rctw/shared-contracts"

// ─── Util ───────────────────────────────────────────────────────────────────────

/** Deterministic avatar color from a userId string (mirrors frontend getAvatarColor) */
function getAvatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  const index = Math.abs(hash) % avatarPalette.length
  return avatarPalette[index]!
}

// ─── Handler ───────────────────────────────────────────────────────────────────

@Injectable()
export class LaserHandler {
  /**
   * Broadcast laser cursor movement to all OTHER users in the room.
   * Not persisted — ephemeral like cursor:move.
   */
  async move(client: Socket, dto: LaserMoveRequest): Promise<void> {
    const { boardId, x, y, isActive, strokeId } = dto
    const currentUser = client.data.currentUser as JwtPayload | undefined
    const userId = currentUser?.sub ?? `guest_${client.id}`
    const userName = currentUser?.name ?? `Guest`

    const event: LaserMovedEvent = {
      boardId,
      user: { id: userId, name: userName },
      x,
      y,
      isActive,
      avatarColor: getAvatarColor(userId),
      strokeId,
    }

    client.to(toBoardSocketName(boardId)).emit(ServerEvents.LASER_MOVED, event)
  }
}
