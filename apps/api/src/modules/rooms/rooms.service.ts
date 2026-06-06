import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  AddRoomMemberRequest,
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomMembersResponse,
  GetRoomResponse,
  JoinRoomResponse,
  ListRoomsQuery,
  ListRoomsResponse,
  RoomRole,
  RoomMemberMutationResponse,
  UpdateRoomMemberRoleRequest,
  UpdateRoomRequest,
  UpdateRoomResponse,
  UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import {
  toDefaultJoinRole,
  toRoomMemberSummary,
  toRoomRole,
  toRoomSummary,
} from "./room-response.mapper"
import { RoomsPermissionService } from "./rooms-permission.service"

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
  constructor(
    private readonly prismaService: PrismaService,
    private readonly roomsPermissionService: RoomsPermissionService,
  ) {}

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

  async joinRoom(
    currentUser: UserSummary,
    roomId: string,
  ): Promise<JoinRoomResponse> {
    const joined = await this.prismaService.client.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: {
          id: roomId,
          deletedAt: null,
        },
        include: {
          ...roomWithCreatorInclude,
          members: {
            where: {
              userId: currentUser.id,
            },
            select: {
              id: true,
              role: true,
              removedAt: true,
            },
            take: 1,
          },
        },
      })

      if (!room) {
        throw this.roomNotFound()
      }

      const existingMember = room.members.at(0)

      if (existingMember && existingMember.removedAt === null) {
        return {
          room,
          role: toRoomRole(existingMember.role),
        }
      }

      if (!room.isPublic) {
        throw this.permissionDenied("You do not have access to this room.")
      }

      const role = toDefaultJoinRole(room.defaultJoinRole)

      await tx.roomMember.upsert({
        where: {
          roomId_userId: {
            roomId,
            userId: currentUser.id,
          },
        },
        create: {
          roomId,
          userId: currentUser.id,
          role,
        },
        update: {
          role,
          joinedAt: new Date(),
          removedAt: null,
        },
      })

      return {
        room,
        role,
      }
    })

    return {
      room: toRoomSummary(joined.room),
      currentUser: {
        ...currentUser,
        role: joined.role,
      },
    }
  }

  async getRoomMembers(
    currentUser: UserSummary,
    roomId: string,
  ): Promise<GetRoomMembersResponse> {
    await this.roomsPermissionService.assertRoomMember(currentUser.id, roomId)

    const members = await this.prismaService.client.roomMember.findMany({
      where: {
        roomId,
        removedAt: null,
      },
      include: {
        user: {
          select: userSummarySelect,
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    })

    return {
      roomId,
      members: members.map(toRoomMemberSummary),
    }
  }

  async addRoomMember(
    currentUser: UserSummary,
    roomId: string,
    request: AddRoomMemberRequest,
  ): Promise<RoomMemberMutationResponse> {
    await this.roomsPermissionService.assertRoomOwner(currentUser.id, roomId)

    const member = await this.prismaService.client.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: {
          id: request.userId,
        },
        select: userSummarySelect,
      })

      if (!targetUser) {
        throw this.memberNotFound("Target user not found.")
      }

      const existingMember = await tx.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: request.userId,
          },
        },
        select: {
          id: true,
          role: true,
          removedAt: true,
        },
      })

      if (existingMember?.role === "OWNER") {
        throw this.validationError("Owner membership cannot be modified.")
      }

      if (existingMember) {
        const reactivationData =
          existingMember.removedAt === null
            ? {}
            : {
                joinedAt: new Date(),
                removedAt: null,
              }

        return tx.roomMember.update({
          where: {
            id: existingMember.id,
          },
          data: {
            ...reactivationData,
            role: request.role,
          },
          include: {
            user: {
              select: userSummarySelect,
            },
          },
        })
      }

      return tx.roomMember.create({
        data: {
          roomId,
          userId: request.userId,
          role: request.role,
        },
        include: {
          user: {
            select: userSummarySelect,
          },
        },
      })
    })

    return {
      member: toRoomMemberSummary(member),
    }
  }

  async updateRoomMemberRole(
    currentUser: UserSummary,
    roomId: string,
    memberId: string,
    request: UpdateRoomMemberRoleRequest,
  ): Promise<RoomMemberMutationResponse> {
    await this.roomsPermissionService.assertRoomOwner(currentUser.id, roomId)

    const member = await this.prismaService.client.$transaction(async (tx) => {
      const existingMember = await tx.roomMember.findFirst({
        where: {
          id: memberId,
          roomId,
          removedAt: null,
        },
        select: {
          id: true,
          role: true,
        },
      })

      if (!existingMember) {
        throw this.memberNotFound()
      }

      if (existingMember.role === "OWNER") {
        throw this.validationError("Owner membership cannot be modified.")
      }

      return tx.roomMember.update({
        where: {
          id: memberId,
        },
        data: {
          role: request.role,
        },
        include: {
          user: {
            select: userSummarySelect,
          },
        },
      })
    })

    return {
      member: toRoomMemberSummary(member),
    }
  }

  async updateRoom(
    currentUser: UserSummary,
    roomId: string,
    request: UpdateRoomRequest,
  ): Promise<UpdateRoomResponse> {
    await this.roomsPermissionService.assertRoomOwner(currentUser.id, roomId)

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
    await this.roomsPermissionService.assertRoomOwner(currentUser.id, roomId)

    await this.prismaService.client.room.update({
      where: {
        id: roomId,
      },
      data: {
        deletedAt: new Date(),
      },
    })
  }

  private resolveAccessibleRole(room: {
    isPublic: boolean
    defaultJoinRole: string
    members: Array<{ role: RoomRole }>
  }): RoomRole {
    const memberRole = room.members.at(0)?.role

    if (memberRole) {
      return toRoomRole(memberRole)
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

  private memberNotFound(message = "Room member not found.") {
    return new NotFoundException({
      code: "MEMBER_NOT_FOUND",
      message,
    })
  }

  private validationError(message: string) {
    return new BadRequestException({
      code: "VALIDATION_ERROR",
      message,
    })
  }

  private permissionDenied(message: string) {
    return new ForbiddenException({
      code: "PERMISSION_DENIED",
      message,
    })
  }
}
