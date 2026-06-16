import { Injectable } from "@nestjs/common"
import { boardRoles, type BoardRole } from "@rctw/shared-contracts"
import {
  BoardNotFoundException,
  PermissionDeniedException,
} from "../../../common/exceptions"
import { BoardMemberRepository } from "../repositories/board-member.repository"

@Injectable()
export class BoardPermissionService {
  constructor(
    private readonly boardMemberRepository: BoardMemberRepository,
  ) {}

  // ── Stateless role checks (no DB call) ───────────────────────────────

  canEdit(role: BoardRole): boolean {
    return role === boardRoles.OWNER || role === boardRoles.EDITOR
  }

  canManage(role: BoardRole): boolean {
    return role === boardRoles.OWNER
  }

  assertCanEdit(
    role: BoardRole,
    message = "Only board owners and editors can edit this board.",
  ): void {
    if (!this.canEdit(role)) {
      throw new PermissionDeniedException(message)
    }
  }

  assertCanManage(
    role: BoardRole,
    message = "Only the board owner can perform this action.",
  ): void {
    if (!this.canManage(role)) {
      throw new PermissionDeniedException(message)
    }
  }

  // ── DB-backed membership asserts ──────────────────────────────────────

  /**
   * Asserts that the user is an active member of the board.
   * Throws BoardNotFoundException if board not found.
   * Throws PermissionDeniedException if user is not a member.
   * @returns the user's BoardRole
   */
  async assertBoardMember(
    userId: string,
    boardId: string,
  ): Promise<BoardRole> {
    const { boardExists, role } =
      await this.boardMemberRepository.findMembership(userId, boardId)

    if (!boardExists) {
      throw new BoardNotFoundException()
    }

    if (!role) {
      throw new PermissionDeniedException("You must join this board first.")
    }

    return role
  }

  /**
   * Asserts that the user is the owner of the board.
   * Throws BoardNotFoundException if board not found.
   * Throws PermissionDeniedException if not owner.
   * @returns the user's BoardRole (always OWNER)
   */
  async assertBoardOwner(
    userId: string,
    boardId: string,
  ): Promise<BoardRole> {
    const role = await this.assertBoardMember(userId, boardId)
    this.assertCanManage(role)
    return role
  }

  /**
   * Asserts that the user can edit the board (OWNER or EDITOR role).
   * Throws BoardNotFoundException if board not found.
   * Throws PermissionDeniedException if not an editor-level member.
   * @returns the user's BoardRole
   */
  async assertBoardEditor(
    userId: string,
    boardId: string,
  ): Promise<BoardRole> {
    const role = await this.assertBoardMember(userId, boardId)
    this.assertCanEdit(role)
    return role
  }
}
