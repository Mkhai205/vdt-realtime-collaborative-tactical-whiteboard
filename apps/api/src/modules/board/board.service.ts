import { Injectable } from "@nestjs/common"
import {
  type AddBoardMemberRequest,
  type BoardMemberSummary,
  type BoardRole,
  type BoardSummary,
  type CreateBoardRequest,
  type CreateBoardResponse,
  type DefaultJoinRole,
  type GetBoardMembersResponse,
  type GetBoardResponse,
  type JwtPayload,
  type ListBoardsQuery,
  type ListBoardsResponse,
  type UpdateBoardMemberRoleRequest,
  type UpdateBoardRequest,
  type UpdateBoardResponse,
  type UserSummary,
  boardRoles,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { userSummarySelect } from "../user/user.service"
import {
  boardNotFound,
  memberNotFound,
  permissionDenied,
  validationError,
} from "./board.utils"

const boardWithCreatorInclude = {
  createdBy: {
    select: userSummarySelect,
  },
} as const

type BoardWithCreator = {
  id: string
  name: string
  description: string | null
  currentRevision: number
  isPublic: boolean
  defaultJoinRole: BoardRole
  createdAt: Date
  updatedAt: Date
  createdBy: UserSummary
}

type BoardMemberWithUser = {
  id: string
  role: BoardRole
  joinedAt: Date
  removedAt: Date | null
  user: UserSummary
}

function toBoardSummary(board: BoardWithCreator): BoardSummary {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    currentRevision: board.currentRevision,
    isPublic: board.isPublic,
    defaultJoinRole: board.defaultJoinRole as DefaultJoinRole,
    createdBy: board.createdBy,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  }
}

function toBoardMemberSummary(member: BoardMemberWithUser): BoardMemberSummary {
  return {
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt,
    user: member.user,
  }
}

@Injectable()
export class BoardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  async createBoard(
    currentUser: JwtPayload,
    request: CreateBoardRequest,
  ): Promise<CreateBoardResponse> {
    const board = await this.prismaService.$transaction(async (tx) =>
      tx.board.create({
        data: {
          name: request.name,
          description: request.description ?? null,
          isPublic: request.isPublic,
          defaultJoinRole: request.defaultJoinRole,
          createdById: currentUser.sub,
          members: {
            create: {
              userId: currentUser.sub,
              role: boardRoles.OWNER,
            },
          },
        },
        include: boardWithCreatorInclude,
      }),
    )

    return toBoardSummary(board)
  }

  async listBoards(
    currentUser: JwtPayload,
    query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    const where = {
      members: {
        some: {
          userId: currentUser.sub,
          removedAt: null,
        },
      },
    } as const

    const [boards, total] = await Promise.all([
      this.prismaService.board.findMany({
        where,
        include: boardWithCreatorInclude,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      }),
      this.prismaService.board.count({ where }),
    ])

    return {
      items: boards.map(toBoardSummary),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
      },
    }
  }

  async getBoard(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardResponse> {
    const board = await this.prismaService.board.findUnique({
      where: { id: boardId },
      include: {
        ...boardWithCreatorInclude,
        members: {
          where: { userId: currentUser.sub, removedAt: null },
          select: { id: true, role: true, joinedAt: true },
          take: 1,
        },
      },
    })

    if (!board) {
      throw boardNotFound()
    }

    const { members, ...boardData } = board

    const role = this.resolveAccessibleRole({
      isPublic: boardData.isPublic,
      defaultJoinRole: boardData.defaultJoinRole,
      members,
    })

    return {
      ...toBoardSummary(boardData),
      memberBoardStatus: {
        id: members.at(0)?.id ?? "",
        role,
        joinedAt: members.at(0)?.joinedAt,
        user: boardData.createdBy,
      },
    }
  }

  async joinBoard(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardResponse> {
    const joined = await this.prismaService.$transaction(async (tx) => {
      const board = await tx.board.findFirst({
        where: { id: boardId },
        include: {
          ...boardWithCreatorInclude,
          members: {
            where: { userId: currentUser.sub },
            select: { id: true, role: true, removedAt: true },
            take: 1,
          },
        },
      })

      if (!board) {
        throw boardNotFound()
      }

      const existingMember = board.members.at(0)

      if (existingMember && existingMember.removedAt === null) {
        return { board, role: existingMember.role, memberId: existingMember.id }
      }

      if (!board.isPublic) {
        throw permissionDenied("You do not have access to this board.")
      }

      const role = board.defaultJoinRole

      const upserted = await tx.boardMember.upsert({
        where: {
          boardId_userId: {
            boardId,
            userId: currentUser.sub,
          },
        },
        create: { boardId, userId: currentUser.sub, role },
        update: { role, joinedAt: new Date(), removedAt: null },
      })

      return { board, role, memberId: upserted.id }
    })

    return {
      ...toBoardSummary(joined.board),
      memberBoardStatus: {
        id: joined.memberId,
        role: joined.role,
        user: joined.board.createdBy,
      },
    }
  }

  async getBoardMembers(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardMembersResponse> {
    await this.boardPermissionService.assertBoardMember(
      currentUser.sub,
      boardId,
    )

    const members = await this.prismaService.boardMember.findMany({
      where: { boardId, removedAt: null },
      include: { user: { select: userSummarySelect } },
      orderBy: { joinedAt: "asc" },
    })

    return members.map(toBoardMemberSummary)
  }

  async addBoardMember(
    currentUser: JwtPayload,
    boardId: string,
    request: AddBoardMemberRequest,
  ): Promise<BoardMemberSummary> {
    await this.boardPermissionService.assertBoardOwner(currentUser.sub, boardId)

    const member = await this.prismaService.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: request.userId },
        select: userSummarySelect,
      })

      if (!targetUser) {
        throw memberNotFound()
      }

      const existingMember = await tx.boardMember.findUnique({
        where: {
          boardId_userId: { boardId, userId: request.userId },
        },
        select: { id: true, role: true, removedAt: true },
      })

      if (existingMember?.role === "OWNER") {
        throw validationError("Owner membership cannot be modified.")
      }

      if (existingMember) {
        const reactivationData =
          existingMember.removedAt === null
            ? {}
            : { joinedAt: new Date(), removedAt: null }

        return tx.boardMember.update({
          where: { id: existingMember.id },
          data: { ...reactivationData, role: request.role },
          include: { user: { select: userSummarySelect } },
        })
      }

      return tx.boardMember.create({
        data: { boardId, userId: request.userId, role: request.role },
        include: { user: { select: userSummarySelect } },
      })
    })

    return toBoardMemberSummary(member)
  }

  async updateBoardMemberRole(
    currentUser: JwtPayload,
    boardId: string,
    memberId: string,
    request: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberSummary> {
    await this.boardPermissionService.assertBoardOwner(currentUser.sub, boardId)

    const member = await this.prismaService.$transaction(async (tx) => {
      const existingMember = await tx.boardMember.findFirst({
        where: { id: memberId, boardId, removedAt: null },
        select: { id: true, role: true },
      })

      if (!existingMember) {
        throw memberNotFound()
      }

      if (existingMember.role === boardRoles.OWNER) {
        throw validationError("Owner membership cannot be modified.")
      }

      return tx.boardMember.update({
        where: { id: memberId },
        data: { role: request.role },
        include: { user: { select: userSummarySelect } },
      })
    })

    return toBoardMemberSummary(member)
  }

  async updateBoard(
    currentUser: JwtPayload,
    boardId: string,
    request: UpdateBoardRequest,
  ): Promise<UpdateBoardResponse> {
    await this.boardPermissionService.assertBoardOwner(currentUser.sub, boardId)

    const board = await this.prismaService.board.update({
      where: { id: boardId },
      data: request,
      include: boardWithCreatorInclude,
    })

    return toBoardSummary(board)
  }

  async deleteBoard(currentUser: JwtPayload, boardId: string): Promise<void> {
    await this.boardPermissionService.assertBoardOwner(currentUser.sub, boardId)

    await this.prismaService.board.delete({
      where: { id: boardId },
    })
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private resolveAccessibleRole(board: {
    isPublic: boolean
    defaultJoinRole: BoardRole
    members: Array<{ role: BoardRole }>
  }): BoardRole {
    const memberRole = board.members.at(0)?.role

    if (memberRole) return memberRole
    if (board.isPublic) return board.defaultJoinRole

    throw permissionDenied("You do not have access to this board.")
  }
}
