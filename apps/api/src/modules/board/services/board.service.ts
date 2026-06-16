import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import {
  type AddBoardMemberRequest,
  type BoardMemberMutationResponse,
  type BoardRole,
  type CreateBoardRequest,
  type CreateBoardResponse,
  type GetBoardMembersResponse,
  type GetBoardResponse,
  type JoinBoardResponse,
  type ListBoardsQuery,
  type ListBoardsResponse,
  type UpdateBoardMemberRoleRequest,
  type UpdateBoardRequest,
  type UpdateBoardResponse,
  type UserSummary,
  apiErrorCodes,
  boardRoles,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "../../permission/services/board-permission.service"
import { toBoardMemberSummary, toBoardSummary } from "../mappers/board-response.mapper"

const userSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  avatarColor: true,
} as const

const boardWithCreatorInclude = {
  createdBy: {
    select: userSummarySelect,
  },
} as const

@Injectable()
export class BoardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  async createBoard(
    currentUser: UserSummary,
    request: CreateBoardRequest,
  ): Promise<CreateBoardResponse> {
    const board = await this.prismaService.$transaction(async (tx) =>
      tx.board.create({
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
        include: boardWithCreatorInclude,
      }),
    )

    return {
      board: toBoardSummary(board),
      currentUser: {
        ...currentUser,
        role: boardRoles.OWNER,
      },
    }
  }

  async listBoards(
    currentUser: UserSummary,
    query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    const boards = await this.prismaService.board.findMany({
      where: {
        deletedAt: null,
        OR: [
          { isPublic: true },
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
      include: boardWithCreatorInclude,
      orderBy: { updatedAt: "desc" },
      take: query.limit,
    })

    return { boards: boards.map(toBoardSummary) }
  }

  async getBoard(
    currentUser: UserSummary,
    boardId: string,
  ): Promise<GetBoardResponse> {
    const board = await this.prismaService.board.findFirst({
      where: { id: boardId, deletedAt: null },
      include: {
        ...boardWithCreatorInclude,
        members: {
          where: { userId: currentUser.id, removedAt: null },
          select: { role: true },
          take: 1,
        },
      },
    })

    if (!board) {
      throw this.boardNotFound()
    }

    const role = this.resolveAccessibleRole(board)

    return {
      board: toBoardSummary(board),
      currentUser: { ...currentUser, role },
    }
  }

  async joinBoard(
    currentUser: UserSummary,
    boardId: string,
  ): Promise<JoinBoardResponse> {
    const joined = await this.prismaService.$transaction(async (tx) => {
      const board = await tx.board.findFirst({
        where: { id: boardId, deletedAt: null },
        include: {
          ...boardWithCreatorInclude,
          members: {
            where: { userId: currentUser.id },
            select: { id: true, role: true, removedAt: true },
            take: 1,
          },
        },
      })

      if (!board) {
        throw this.boardNotFound()
      }

      const existingMember = board.members.at(0)

      if (existingMember && existingMember.removedAt === null) {
        return { board, role: existingMember.role }
      }

      if (!board.isPublic) {
        throw this.permissionDenied("You do not have access to this board.")
      }

      const role = board.defaultJoinRole

      await tx.boardMember.upsert({
        where: {
          boardId_userId: {
            boardId,
            userId: currentUser.id,
          },
        },
        create: { boardId, userId: currentUser.id, role },
        update: { role, joinedAt: new Date(), removedAt: null },
      })

      return { board, role }
    })

    return {
      board: toBoardSummary(joined.board),
      currentUser: { ...currentUser, role: joined.role },
    }
  }

  async getBoardMembers(
    currentUser: UserSummary,
    boardId: string,
  ): Promise<GetBoardMembersResponse> {
    await this.boardPermissionService.assertBoardMember(currentUser.id, boardId)

    const members = await this.prismaService.boardMember.findMany({
      where: { boardId, removedAt: null },
      include: { user: { select: userSummarySelect } },
      orderBy: { joinedAt: "asc" },
    })

    return {
      boardId,
      members: members.map(toBoardMemberSummary),
    }
  }

  async addBoardMember(
    currentUser: UserSummary,
    boardId: string,
    request: AddBoardMemberRequest,
  ): Promise<BoardMemberMutationResponse> {
    await this.boardPermissionService.assertBoardOwner(currentUser.id, boardId)

    const member = await this.prismaService.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: request.userId },
        select: userSummarySelect,
      })

      if (!targetUser) {
        throw this.memberNotFound("Target user not found.")
      }

      const existingMember = await tx.boardMember.findUnique({
        where: {
          boardId_userId: { boardId, userId: request.userId },
        },
        select: { id: true, role: true, removedAt: true },
      })

      if (existingMember?.role === "OWNER") {
        throw this.validationError("Owner membership cannot be modified.")
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

    return { member: toBoardMemberSummary(member) }
  }

  async updateBoardMemberRole(
    currentUser: UserSummary,
    boardId: string,
    memberId: string,
    request: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberMutationResponse> {
    await this.boardPermissionService.assertBoardOwner(currentUser.id, boardId)

    const member = await this.prismaService.$transaction(async (tx) => {
      const existingMember = await tx.boardMember.findFirst({
        where: { id: memberId, boardId, removedAt: null },
        select: { id: true, role: true },
      })

      if (!existingMember) {
        throw this.memberNotFound()
      }

      if (existingMember.role === boardRoles.OWNER) {
        throw this.validationError("Owner membership cannot be modified.")
      }

      return tx.boardMember.update({
        where: { id: memberId },
        data: { role: request.role },
        include: { user: { select: userSummarySelect } },
      })
    })

    return { member: toBoardMemberSummary(member) }
  }

  async updateBoard(
    currentUser: UserSummary,
    boardId: string,
    request: UpdateBoardRequest,
  ): Promise<UpdateBoardResponse> {
    await this.boardPermissionService.assertBoardOwner(currentUser.id, boardId)

    const board = await this.prismaService.board.update({
      where: { id: boardId },
      data: request,
      include: boardWithCreatorInclude,
    })

    return { board: toBoardSummary(board) }
  }

  async deleteBoard(currentUser: UserSummary, boardId: string): Promise<void> {
    await this.boardPermissionService.assertBoardOwner(currentUser.id, boardId)

    await this.prismaService.board.update({
      where: { id: boardId },
      data: { deletedAt: new Date() },
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

    throw this.permissionDenied("You do not have access to this board.")
  }

  private boardNotFound(message = "Board not found.") {
    return new NotFoundException({
      code: apiErrorCodes.BOARD_NOT_FOUND,
      message,
    })
  }

  private memberNotFound(message = "Board member not found.") {
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
