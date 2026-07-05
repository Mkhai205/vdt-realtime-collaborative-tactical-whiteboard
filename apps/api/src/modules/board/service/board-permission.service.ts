import { Injectable } from "@nestjs/common"
import {
  boardVisibility,
  effectiveBoardRoles,
  type EffectiveBoardRole,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"
import { AppException } from "../../../common/exceptions"
import { BoardRecord, boardSelect } from "./board.service"

@Injectable()
export class BoardPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  canEdit(role: EffectiveBoardRole): boolean {
    return (
      role === effectiveBoardRoles.OWNER || role === effectiveBoardRoles.EDITOR
    )
  }

  canManage(role: EffectiveBoardRole): boolean {
    return role === effectiveBoardRoles.OWNER
  }

  async resolveAccess(
    userId: string | undefined,
    boardId: string,
  ): Promise<{ board: BoardRecord; effectiveRole: EffectiveBoardRole }> {
    const boardData = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        ...boardSelect,
        members: userId
          ? {
              where: { userId },
              select: { role: true },
              take: 1,
            }
          : undefined,
      },
    })

    if (!boardData) {
      throw AppException.boardNotFound()
    }

    const { members, ...board } = boardData

    const memberRole = members && members.length > 0 ? members[0]?.role : undefined
    const visibility = board.visibility

    if (visibility === boardVisibility.PRIVATE && !memberRole) {
      throw AppException.permissionDenied(
        "You do not have access to this board.",
      )
    }

    const effectiveRole = memberRole
      ? memberRole
      : effectiveBoardRoles.PUBLIC_VIEWER

    return { board, effectiveRole }
  }

  async assertFormalEditor(
    userId: string,
    boardId: string,
  ): Promise<{ board: BoardRecord; effectiveRole: EffectiveBoardRole }> {
    const result = await this.resolveAccess(userId, boardId)

    if (!this.canEdit(result.effectiveRole)) {
      throw AppException.permissionDenied(
        "Only board owners and editors can perform this action.",
      )
    }

    return result
  }

  async assertFormalOwner(
    userId: string,
    boardId: string,
  ): Promise<{ board: BoardRecord; effectiveRole: EffectiveBoardRole }> {
    const result = await this.resolveAccess(userId, boardId)

    if (!this.canManage(result.effectiveRole)) {
      throw AppException.permissionDenied(
        "Only the board owner can perform this action.",
      )
    }

    return result
  }
}
