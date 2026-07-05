import { Injectable } from "@nestjs/common"
import {
  boardRoles,
  type BoardMemberResponse,
  type ListBoardMembersResponse,
  type AddBoardMemberRequest,
  type JwtPayload,
  type UpdateBoardMemberRoleRequest,
} from "@rctw/shared-contracts"
import { Prisma } from "@rctw/database"
import { userSummarySelect } from "../../user/user.service"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { AppException } from "../../../common/exceptions"

export const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: userSummarySelect },
} satisfies Prisma.BoardMemberSelect

export type BoardMemberRecord = Prisma.BoardMemberGetPayload<{
  select: typeof memberSelect
}>

@Injectable()
export class BoardMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  async listBoardMembers(
    currentUser: JwtPayload | undefined,
    boardId: string,
  ): Promise<ListBoardMembersResponse> {
    await this.boardPermissionService.resolveAccess(currentUser?.sub, boardId)

    const members = await this.prisma.boardMember.findMany({
      where: { boardId },
      select: memberSelect,
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    })

    return members.map(toBoardMemberResponse)
  }

  async addBoardMember(
    currentUser: JwtPayload,
    boardId: string,
    request: AddBoardMemberRequest,
  ): Promise<BoardMemberResponse> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

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

      if (existing) {
        throw AppException.conflict(
          `User "${request.email}" is already an active member of this board.`,
        )
      }

      return tx.boardMember.create({
        data: { boardId, userId: targetUser.id, role: request.role },
        select: memberSelect,
      })
    })

    return toBoardMemberResponse(member)
  }

  async updateBoardMemberRole(
    currentUser: JwtPayload,
    boardId: string,
    memberId: string,
    request: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberResponse> {
    await this.boardPermissionService.assertFormalOwner(
      currentUser.sub,
      boardId,
    )

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

    return toBoardMemberResponse(updated)
  }

  async removeBoardMember(
    currentUser: JwtPayload,
    boardId: string,
    memberId: string,
  ): Promise<void> {
    await this.boardPermissionService.assertFormalOwner(
      currentUser.sub,
      boardId,
    )

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

function toBoardMemberResponse(member: BoardMemberRecord): BoardMemberResponse {
  return {
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: member.user,
  }
}
