import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomResponse,
  ListRoomsQuery,
  ListRoomsResponse,
  RoomRole,
  UpdateRoomRequest,
  UpdateRoomResponse,
  UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { toDefaultJoinRole, toRoomSummary } from "./room-response.mapper"

const userSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  avatarColor: true,
} as const

const roomWithCreatorInclude = {
  createdBy: {
    select: userSummarySelect,
  },
} as const

@Injectable()
export class RoomsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createRoom(
    currentUser: UserSummary,
    request: CreateRoomRequest,
  ): Promise<CreateRoomResponse> {
    const room = await this.prismaService.client.$transaction(async (tx) =>
      tx.room.create({
        data: {
          name: request.name,
          description: request.description ?? null,
          isPublic: request.isPublic,
          defaultJoinRole: request.defaultJoinRole,
          createdById: currentUser.id,
          members: {
            create: {
              userId: currentUser.id,
              role: "OWNER",
            },
          },
        },
        include: roomWithCreatorInclude,
      }),
    )

    return {
      room: toRoomSummary(room),
      currentUser: {
        ...currentUser,
        role: "OWNER",
      },
    }
  }

  async listRooms(
    currentUser: UserSummary,
    query: ListRoomsQuery,
  ): Promise<ListRoomsResponse> {
    const rooms = await this.prismaService.client.room.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            isPublic: true,
          },
          {
            members: {
              some: {
                userId: currentUser.id,
                removedAt: null,
              },
            },
          },
        ],
      },
      include: roomWithCreatorInclude,
      orderBy: {
        updatedAt: "desc",
      },
      take: query.limit,
    })

    return {
      rooms: rooms.map(toRoomSummary),
    }
  }

  async getRoom(
    currentUser: UserSummary,
    roomId: string,
  ): Promise<GetRoomResponse> {
    const room = await this.prismaService.client.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      include: {
        ...roomWithCreatorInclude,
        members: {
          where: {
            userId: currentUser.id,
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

    const role = this.resolveAccessibleRole(room)

    return {
      room: toRoomSummary(room),
      currentUser: {
        ...currentUser,
        role,
      },
    }
  }

  async updateRoom(
    currentUser: UserSummary,
    roomId: string,
    request: UpdateRoomRequest,
  ): Promise<UpdateRoomResponse> {
    await this.assertOwner(currentUser, roomId)

    const room = await this.prismaService.client.room.update({
      where: {
        id: roomId,
      },
      data: this.toUpdateData(request),
      include: roomWithCreatorInclude,
    })

    return {
      room: toRoomSummary(room),
    }
  }

  async deleteRoom(currentUser: UserSummary, roomId: string): Promise<void> {
    await this.assertOwner(currentUser, roomId)

    await this.prismaService.client.room.update({
      where: {
        id: roomId,
      },
      data: {
        deletedAt: new Date(),
      },
    })
  }

  private async assertOwner(
    currentUser: UserSummary,
    roomId: string,
  ): Promise<void> {
    const room = await this.prismaService.client.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      select: {
        members: {
          where: {
            userId: currentUser.id,
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

    if (room.members.at(0)?.role !== "OWNER") {
      throw this.permissionDenied("Only the room owner can modify this room.")
    }
  }

  private resolveAccessibleRole(room: {
    isPublic: boolean
    defaultJoinRole: string
    members: Array<{ role: RoomRole }>
  }): RoomRole {
    const memberRole = room.members.at(0)?.role

    if (memberRole) {
      return memberRole
    }

    if (room.isPublic) {
      return toDefaultJoinRole(room.defaultJoinRole)
    }

    throw this.permissionDenied("You do not have access to this room.")
  }

  private toUpdateData(request: UpdateRoomRequest): {
    name?: string
    description?: string | null
    isPublic?: boolean
    defaultJoinRole?: "EDITOR" | "VIEWER"
  } {
    const data: {
      name?: string
      description?: string | null
      isPublic?: boolean
      defaultJoinRole?: "EDITOR" | "VIEWER"
    } = {}

    if ("name" in request) {
      data.name = request.name
    }

    if ("description" in request) {
      data.description = request.description ?? null
    }

    if ("isPublic" in request) {
      data.isPublic = request.isPublic
    }

    if ("defaultJoinRole" in request) {
      data.defaultJoinRole = request.defaultJoinRole
    }

    return data
  }

  private roomNotFound() {
    return new NotFoundException({
      code: "ROOM_NOT_FOUND",
      message: "Room not found.",
    })
  }

  private permissionDenied(message: string) {
    return new ForbiddenException({
      code: "PERMISSION_DENIED",
      message,
    })
  }
}
