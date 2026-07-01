import { Injectable, Logger } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  toBoardSocketName,
  ServerEvents,
} from "@rctw/shared-contracts"
import { PresenceService } from "../services/presence.service"

@Injectable()
export class PresenceHandler {
  private readonly logger = new Logger(PresenceHandler.name)

  constructor(private readonly presenceService: PresenceService) {}

  /**
   * Xử lý khi socket mới kết nối
   */
  async handleConnection(client: Socket): Promise<void> {
    const currentUser = client.data.currentUser as JwtPayload
    if (currentUser) {
      this.logger.log(
        `🟢 Socket connected: ${client.id} (User: ${currentUser.name})`,
      )
    } else {
      this.logger.log(`🟢 Socket connected: ${client.id} (Guest)`)
    }
  }

  /**
   * Xử lý khi socket ngắt kết nối
   */
  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`🔴 Socket disconnected: ${client.id}`)

    try {
      // Dọn dẹp presence & editing states của socket trong Redis & memory
      const { affectedBoards, endedEditingStates } =
        await this.presenceService.clearAllForSocket(client.id)

      // 1. Broadcast presence update tới các board bị ảnh hưởng
      for (const affected of affectedBoards) {
        client.nsp
          .to(toBoardSocketName(affected.boardId))
          .emit(ServerEvents.PRESENCE_UPDATE, {
            boardId: affected.boardId,
            onlineUsers: affected.onlineUsers,
          })
      }

      // 2. Broadcast kết thúc editing states cho các object tương ứng
      for (const state of endedEditingStates) {
        client.nsp
          .to(toBoardSocketName(state.boardId))
          .emit(ServerEvents.OBJECT_EDITING, {
            boardId: state.boardId,
            objectId: state.objectId,
            user: state.user,
            status: "ENDED" as const,
            timestamp: new Date().toISOString(),
          })
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling disconnect for socket ${client.id}: ${error.message}`,
      )
    }
  }
}
