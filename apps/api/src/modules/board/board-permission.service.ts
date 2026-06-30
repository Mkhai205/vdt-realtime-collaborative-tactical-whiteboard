import { Injectable } from "@nestjs/common"
import {
  boardVisibility,
  effectiveBoardRoles,
  type EffectiveBoardRole,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { AppException } from "../../common/exceptions"

@Injectable()
export class BoardPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Sync helpers (no DB) ────────────────────────────────────────────────────

  canEdit(role: EffectiveBoardRole): boolean {
    return (
      role === effectiveBoardRoles.OWNER || role === effectiveBoardRoles.EDITOR
    )
  }

  canManage(role: EffectiveBoardRole): boolean {
    return role === effectiveBoardRoles.OWNER
  }

  // ─── DB queries ───────────────────────────────────────────────────────────────

  async resolveAccess(
    userId: string,
    boardId: string,
  ): Promise<EffectiveBoardRole> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        visibility: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    })

    if (!board) {
      throw AppException.boardNotFound()
    }

    const memberRole = board.members.at(0)?.role
    const visibility = board.visibility

    if (visibility === boardVisibility.PRIVATE && !memberRole) {
      throw AppException.permissionDenied(
        "You do not have access to this board.",
      )
    }

    const effectiveRole = memberRole
      ? memberRole
      : effectiveBoardRoles.PUBLIC_VIEWER

    return effectiveRole
  }

  async assertFormalEditor(
    userId: string,
    boardId: string,
  ): Promise<EffectiveBoardRole> {
    const result = await this.resolveAccess(userId, boardId)

    if (!this.canEdit(result)) {
      throw AppException.permissionDenied(
        "Only board owners and editors can perform this action.",
      )
    }

    return result
  }

  async assertFormalOwner(
    userId: string,
    boardId: string,
  ): Promise<EffectiveBoardRole> {
    const result = await this.resolveAccess(userId, boardId)

    if (!this.canManage(result)) {
      throw AppException.permissionDenied(
        "Only the board owner can perform this action.",
      )
    }

    return result
  }
}
