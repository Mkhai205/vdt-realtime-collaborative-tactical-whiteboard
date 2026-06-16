import { Injectable } from "@nestjs/common"
import type { BoardRole } from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"

export type BoardMemberRecord = {
  role: BoardRole
}

@Injectable()
export class BoardMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the member's role if the board exists and the user is a member.
   * Returns null if the board does not exist (deletedAt != null counts as not found).
   * Returns undefined if the board exists but the user has no active membership.
   */
  async findMembership(
    userId: string,
    boardId: string,
  ): Promise<{ boardExists: boolean; role: BoardRole | null }> {
    const board = await this.prisma.board.findFirst({
      where: {
        id: boardId,
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

    if (!board) {
      return { boardExists: false, role: null }
    }

    const member = board.members.at(0)
    return { boardExists: true, role: member?.role ?? null }
  }
}
