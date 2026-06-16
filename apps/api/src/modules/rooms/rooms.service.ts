import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import {
  type AddBoardMemberRequest,
  type CreateBoardRequest,
  type CreateBoardResponse,
  type GetBoardMembersResponse,
  type GetBoardResponse,
  type JoinBoardResponse,
  type ListBoardsQuery,
  type ListBoardsResponse,
  type BoardRole,
  type BoardMemberMutationResponse,
  type UpdateBoardMemberRoleRequest,
  type UpdateBoardRequest,
  type UpdateBoardResponse,
  type UserSummary,
  apiErrorCodes,
  boardRoles,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { toRoomMemberSummary, toRoomSummary } from "./room-response.mapper"
import { BoardPermissionService } from "../permission/services/board-permission.service"

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
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  async createRoom(
    currentUser: UserSummary,
    request: CreateRoomRequest,
  ): Promise<CreateRoomResponse> {
    const room = await this.prismaService.$transaction(async (tx) =>
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
              role: boardRoles.OWNER,
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
        role: boardRoles.OWNER,
      },
    }
  }

  async listRooms(
    currentUser: UserSummary,
    query: ListRoomsQuery,
  ): Promise<ListRoomsResponse> {
    const rooms = await this.prismaService.room.findMany({
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
    const room = await this.prismaService.room.findFirst({
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
    const joined = await this.prismaService.$transaction(async (tx) => {
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
          role: existingMember.role,
        }
      }

      if (!room.isPublic) {
        throw this.permissionDenied("You do not have access to this room.")
      }

      const role = room.defaultJoinRole

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
    await this.boardPermissionService.assertBoardMember(currentUser.id, roomId)

    const members = await this.prismaService.roomMember.findMany({
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
    await this.boardPermissionService.assertBoardOwner(currentUser.id, roomId)

    const member = await this.prismaService.$transaction(async (tx) => {
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
    await this.boardPermissionService.assertBoardOwner(currentUser.id, roomId)

    const member = await this.prismaService.$transaction(async (tx) => {
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

      if (existingMember.role === boardRoles.OWNER) {
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
    await this.boardPermissionService.assertBoardOwner(currentUser.id, roomId)

    const room = await this.prismaService.room.update({
      where: {
        id: roomId,
      },
      data: request,
      include: roomWithCreatorInclude,
    })

    return {
      room: toRoomSummary(room),
    }
  }

  async deleteRoom(currentUser: UserSummary, roomId: string): Promise<void> {
    await this.boardPermissionService.assertBoardOwner(currentUser.id, roomId)

    await this.prismaService.room.update({
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
    defaultJoinRole: BoardRole
    members: Array<{ role: BoardRole }>
  }): BoardRole {
    const memberRole = room.members.at(0)?.role

    if (memberRole) {
      return memberRole
    }

    if (room.isPublic) {
      return room.defaultJoinRole
    }

    throw this.permissionDenied("You do not have access to this room.")
  }

  private roomNotFound(message = "Board not found.") {
    return new NotFoundException({
      code: apiErrorCodes.BOARD_NOT_FOUND,
      message,
    })
  }

  private memberNotFound(message = "Room member not found.") {
    return new NotFoundException({
      code: apiErrorCodes.MEMBER_NOT_FOUND,
      message,
    })
  }

  private validationError(message: string) {
    return new BadRequestException({
      code: apiErrorCodes.VALIDATION_ERROR,
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
