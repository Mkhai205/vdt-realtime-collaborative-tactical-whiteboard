import { Injectable, Logger } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type ObjectEditingEvent,
  toBoardSocketName,
  ServerEvents,
  type ObjectEditingRequest,
} from "@rctw/shared-contracts"
import { PresenceService } from "../services/presence.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class SelectionHandler {
  private readonly logger = new Logger(SelectionHandler.name)

  constructor(private readonly presenceService: PresenceService) {}

  /**
   * Xử lý trạng thái đang chỉnh sửa object (awareness)
   */
  async handleObjectEditing(
    client: Socket,
    dto: ObjectEditingRequest,
  ): Promise<void> {
    const { boardId, objectId, status } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    // Cập nhật trạng thái in-memory & Redis
    if (status === "STARTED") {
      await this.presenceService.setEditing(client.id, boardId, objectId, {
        id: currentUser.sub,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        avatarColor: currentUser.avatarColor,
      })
    } else {
      await this.presenceService.clearEditing(client.id, boardId, objectId)
    }

    const event: ObjectEditingEvent = {
      boardId,
      objectId,
      user: {
        id: currentUser.sub,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        avatarColor: currentUser.avatarColor,
      },
      status,
      timestamp: new Date().toISOString(),
    }

    // Broadcast tới các client khác trong board (ngoại trừ người gửi)
    client.to(roomName).emit(ServerEvents.OBJECT_EDITING, event)
  }
}
