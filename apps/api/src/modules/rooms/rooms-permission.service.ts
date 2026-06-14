import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { apiErrorCodes, roomRoles, type RoomRole } from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"

@Injectable()
export class RoomsPermissionService {
  constructor(private readonly prismaService: PrismaService) {}

  canEdit(role: RoomRole): boolean {
    return role === roomRoles.OWNER || role === roomRoles.EDITOR
  }

  canManageRoom(role: RoomRole): boolean {
    return role === roomRoles.OWNER
  }

  assertCanEdit(
    role: RoomRole,
    message = "Only room owners and editors can edit this room.",
  ): void {
    if (!this.canEdit(role)) {
      throw this.permissionDenied(message)
    }
  }

  assertCanManageRoom(
    role: RoomRole,
    message = "Only the room owner can modify this room.",
  ): void {
    if (!this.canManageRoom(role)) {
      throw this.permissionDenied(message)
    }
  }

  async assertRoomMember(userId: string, roomId: string): Promise<RoomRole> {
    const room = await this.prismaService.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      select: {
        members: {
          where: {
            userId,
            removedAt: null,
          },
          select: {
            role: true,
          },
          take: 1,
        },
      },
    })

    if (!room) {
      throw this.roomNotFound()
    }

    const role = room.members.at(0)?.role

    if (!role) {
      throw this.permissionDenied("You must join this room first.")
    }

    return role
  }

  async assertRoomOwner(userId: string, roomId: string): Promise<RoomRole> {
    const role = await this.assertRoomMember(userId, roomId)

    this.assertCanManageRoom(role)

    return role
  }

  private roomNotFound(message = "Room not found.") {
    return new NotFoundException({
      code: apiErrorCodes.ROOM_NOT_FOUND,
      message,
    })
  }

  private permissionDenied(message: string) {
    return new ForbiddenException({
      code: apiErrorCodes.PERMISSION_DENIED,
      message,
    })
  }
}
