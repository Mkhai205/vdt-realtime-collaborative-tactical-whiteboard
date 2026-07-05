import { Injectable } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type CursorMovedEvent,
  toBoardSocketName,
  ServerEvents,
  type CursorMoveRequest,
} from "@rctw/shared-contracts"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class CursorHandler {
  /**
   * Di chuyển cursor (realtime broadcast, không lưu DB)
   */
  async move(client: Socket, dto: CursorMoveRequest): Promise<void> {
    const { boardId, x, y, viewportCenterX, viewportCenterY, viewportScale } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload | undefined
    const userId = currentUser ? currentUser.sub : `guest_${client.id}`
    const userName = currentUser ? currentUser.name : `Guest ${client.id.substring(0, 4)}`

    const event: CursorMovedEvent = {
      boardId,
      user: {
        id: userId,
        name: userName,
      },
      x,
      y,
      viewportCenterX,
      viewportCenterY,
      viewportScale,
    }

    // Broadcast tới các client khác trong board (ngoại trừ người gửi)
    client.to(roomName).emit(ServerEvents.CURSOR_MOVED, event)
  }
}
