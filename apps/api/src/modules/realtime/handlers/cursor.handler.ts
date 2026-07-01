import { Injectable, Logger } from "@nestjs/common"
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
  private readonly logger = new Logger(CursorHandler.name)

  /**
   * Di chuyển cursor (realtime broadcast, không lưu DB)
   */
  async move(client: Socket, dto: CursorMoveRequest): Promise<void> {
    const { boardId, x, y } = dto
    const roomName = toBoardSocketName(boardId)

    try {
      const currentUser = client.data.currentUser as JwtPayload
      if (!currentUser) throw AppException.unauthenticated()

      const event: CursorMovedEvent = {
        boardId,
        user: {
          id: currentUser.sub,
          name: currentUser.name,
        },
        x,
        y,
      }

      // Broadcast tới các client khác trong board (ngoại trừ người gửi)
      client.to(roomName).emit(ServerEvents.CURSOR_MOVED, event)
    } catch (error: any) {
      // Vì cursor move gửi liên tục tần suất cao, lỗi không nên spam log nặng nề
      this.logger.warn(`Cursor move error: ${error.message}`)
    }
  }
}
