import { Injectable } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type ObjectEditingEvent,
  toBoardSocketName,
  ServerEvents,
  type ObjectEditingRequest,
} from "@rctw/shared-contracts"
import { PresenceService } from "../services/presence.service"
import { BoardPermissionService } from "../../board/service/board-permission.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class SelectionHandler {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

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

    // Kiểm tra quyền: Chỉ cho phép Editor hoặc Owner bắt đầu lock/edit object
    const result = await this.boardPermissionService.resolveAccess(
      currentUser.sub,
      boardId,
    )
    if (!this.boardPermissionService.canEdit(result.effectiveRole)) {
      throw AppException.permissionDenied(
        "Only board owners and editors can edit objects.",
      )
    }

    // Cập nhật trạng thái in-memory & Redis
    if (status === "STARTED") {
      // Enforce selection/editing lock
      const isLocked = await this.presenceService.isLockedByOther(
        boardId,
        objectId,
        client.id,
      )
      if (isLocked) {
        throw AppException.objectLocked("Object is locked", { objectId })
      }

      await this.presenceService.setEditing(client.id, boardId, objectId, {
        id: currentUser.sub,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
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
      },
      status,
      timestamp: new Date().toISOString(),
    }

    // Broadcast tới các client khác trong board (ngoại trừ người gửi)
    client.to(roomName).emit(ServerEvents.OBJECT_EDITING, event)
  }
}
