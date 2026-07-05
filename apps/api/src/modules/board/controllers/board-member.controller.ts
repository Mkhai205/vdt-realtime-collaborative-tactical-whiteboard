import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common"
import {
  addBoardMemberRequestSchema,
  updateBoardMemberRoleRequestSchema,
  type BoardMemberResponse,
  type ListBoardMembersResponse,
  type AddBoardMemberRequest,
  type JwtPayload,
  type UpdateBoardMemberRoleRequest,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { Public } from "../../../common/decorators/public.decorator"
import { ZodBody } from "../../../common/pipes/zod-validation.pipe"
import { BoardMemberService } from "../service/board-member.service"

@Controller("boards/:boardId/members")
export class BoardMemberController {
  constructor(private readonly boardMemberService: BoardMemberService) {}

  @Public()
  @Get()
  async listBoardMembers(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<ListBoardMembersResponse> {
    return this.boardMemberService.listBoardMembers(currentUser, boardId)
  }

  @Post()
  async addBoardMember(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodBody(addBoardMemberRequestSchema) body: AddBoardMemberRequest,
  ): Promise<BoardMemberResponse> {
    return this.boardMemberService.addBoardMember(currentUser, boardId, body)
  }

  @Patch(":memberId")
  async updateBoardMemberRole(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @ZodBody(updateBoardMemberRoleRequestSchema)
    body: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberResponse> {
    return this.boardMemberService.updateBoardMemberRole(
      currentUser,
      boardId,
      memberId,
      body,
    )
  }

  @Delete(":memberId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBoardMember(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    await this.boardMemberService.removeBoardMember(
      currentUser,
      boardId,
      memberId,
    )
  }
}
