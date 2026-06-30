import { Injectable } from "@nestjs/common"
import {
  boardRoles,
  type AddBoardMemberRequest,
  type AddBoardMemberResponse,
  type CreateBoardRequest,
  type CreateBoardResponse,
  type GetBoardMembersResponse,
  type GetBoardResponse,
  type JwtPayload,
  type ListBoardsQuery,
  type ListBoardsResponse,
  type UpdateBoardInfoRequest,
  type UpdateBoardInfoResponse,
  type UpdateBoardMemberRoleRequest,
  type UpdateBoardMemberRoleResponse,
  type UpdateBoardSettingsRequest,
  type UpdateBoardSettingsResponse,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { userSummarySelect } from "../user/user.service"
import { AppException } from "../../common/exceptions"

// ─── Prisma select helpers ─────────────────────────────────────────────────────

const boardSelect = {
  id: true,
  name: true,
  description: true,
  visibility: true,
  linkAccess: true,
  currentRevision: true,
  createdBy: { select: userSummarySelect },
  createdAt: true,
  updatedAt: true,
} as const

const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: userSummarySelect },
} as const

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: BoardPermissionService,
  ) {}

  async createBoard(
    currentUser: JwtPayload,
    request: CreateBoardRequest,
  ): Promise<CreateBoardResponse> {
    const board = await this.prisma.board.create({
      data: {
        name: request.name,
        description: request.description ?? null,
        visibility: request.visibility,
        createdById: currentUser.sub,
        members: {
          create: {
            userId: currentUser.sub,
            role: boardRoles.OWNER,
          },
        },
      },
      select: boardSelect,
    })

    return board
  }

  async listBoards(
    currentUser: JwtPayload,
    query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    const where = {
      members: {
        some: { userId: currentUser.sub, removedAt: null },
      },
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    }

    const [boards, total] = await Promise.all([
      this.prisma.board.findMany({
        where,
        select: boardSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.board.count({ where }),
    ])

    return {
      items: boards,
      meta: { total, page: query.page, limit: query.limit },
    }
  }

  async getBoard(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardResponse> {
    const effectiveRole = await this.permission.resolveAccess(
      currentUser.sub,
      boardId,
    )

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        ...boardSelect,
      },
    })

    if (!board) throw AppException.boardNotFound()

    return {
      ...board,
      effectiveRole,
    }
  }

  async updateBoardInfo(
    currentUser: JwtPayload,
    boardId: string,
    request: UpdateBoardInfoRequest,
  ): Promise<UpdateBoardInfoResponse> {
    await this.permission.assertFormalEditor(currentUser.sub, boardId)

    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(request.name !== undefined && { name: request.name }),
        ...(request.description !== undefined && {
          description: request.description,
        }),
      },
      select: boardSelect,
    })

    return board
  }

  async updateBoardSettings(
    currentUser: JwtPayload,
    boardId: string,
    request: UpdateBoardSettingsRequest,
  ): Promise<UpdateBoardSettingsResponse> {
    await this.permission.assertFormalOwner(currentUser.sub, boardId)

    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(request.visibility !== undefined && {
          visibility: request.visibility,
        }),
      },
      select: boardSelect,
    })

    return board
  }

  async deleteBoard(currentUser: JwtPayload, boardId: string): Promise<void> {
    await this.permission.assertFormalOwner(currentUser.sub, boardId)
    await this.prisma.board.delete({ where: { id: boardId } })
  }

  // ─── Member management ─────────────────────────────────────────────────────

  async getBoardMembers(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardMembersResponse> {
    await this.permission.resolveAccess(currentUser.sub, boardId)

    const members = await this.prisma.boardMember.findMany({
      where: { boardId },
      select: memberSelect,
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    })

    return members
  }

  async addBoardMember(
    currentUser: JwtPayload,
    boardId: string,
    request: AddBoardMemberRequest,
  ): Promise<AddBoardMemberResponse> {
    await this.permission.assertFormalEditor(currentUser.sub, boardId)

    const member = await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { email: request.email },
        select: userSummarySelect,
      })

      if (!targetUser) {
        throw AppException.userNotFound(
          `No user found with email "${request.email}".`,
        )
      }

      const existing = await tx.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: targetUser.id } },
        select: { id: true },
      })

      // Đã là active member
      if (existing) {
        throw AppException.conflict(
          `User "${request.email}" is already an active member of this board.`,
        )
      }

      // Thành viên mới
      return tx.boardMember.create({
        data: { boardId, userId: targetUser.id, role: request.role },
        select: memberSelect,
      })
    })

    return member
  }

  async updateBoardMemberRole(
    currentUser: JwtPayload,
    boardId: string,
    memberId: string,
    request: UpdateBoardMemberRoleRequest,
  ): Promise<UpdateBoardMemberRoleResponse> {
    await this.permission.assertFormalOwner(currentUser.sub, boardId)

    const updated = await this.prisma.$transaction(async (tx) => {
      const target = await tx.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: memberId } },
        select: { id: true, role: true, userId: true },
      })

      if (!target) throw AppException.memberNotFound()

      if (target.userId === currentUser.sub) {
        throw AppException.validationError("You cannot change your own role.")
      }

      const isTransferOwnership = request.role === boardRoles.OWNER

      if (!isTransferOwnership) {
        if (target.role === boardRoles.OWNER) {
          throw AppException.validationError(
            "Cannot change the role of the board owner. Use transfer ownership instead.",
          )
        }

        return tx.boardMember.update({
          where: { boardId_userId: { boardId, userId: memberId } },
          data: { role: request.role },
          select: memberSelect,
        })
      }

      // Transfer ownership: target → OWNER, currentUser → EDITOR
      const [updatedTarget] = await Promise.all([
        tx.boardMember.update({
          where: { boardId_userId: { boardId, userId: memberId } },
          data: { role: boardRoles.OWNER },
          select: memberSelect,
        }),
        tx.boardMember.update({
          where: { boardId_userId: { boardId, userId: currentUser.sub } },
          data: { role: boardRoles.EDITOR },
        }),
      ])

      return updatedTarget
    })

    return updated
  }

  async removeBoardMember(
    currentUser: JwtPayload,
    boardId: string,
    memberId: string,
  ): Promise<void> {
    await this.permission.assertFormalOwner(currentUser.sub, boardId)

    await this.prisma.$transaction(async (tx) => {
      const target = await tx.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: memberId } },
        select: { id: true, role: true, userId: true },
      })

      if (!target) throw AppException.memberNotFound()

      if (target.role === boardRoles.OWNER) {
        throw AppException.validationError("Cannot remove the board owner.")
      }

      if (target.userId === currentUser.sub) {
        throw AppException.validationError(
          "Cannot remove yourself from the board.",
        )
      }

      await tx.boardMember.delete({
        where: { boardId_userId: { boardId, userId: memberId } },
      })
    })
  }
}
