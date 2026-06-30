import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from "@nestjs/common"
import {
  addBoardMemberRequestSchema,
  boardIdParamsSchema,
  boardMemberIdParamsSchema,
  createBoardRequestSchema,
  listBoardsQuerySchema,
  updateBoardInfoRequestSchema,
  updateBoardMemberRoleRequestSchema,
  updateBoardSettingsRequestSchema,
  type AddBoardMemberRequest,
  type AddBoardMemberResponse,
  type BoardIdParams,
  type BoardMemberIdParams,
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
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodBody, ZodParam, ZodQuery } from "../../common/pipes"
import { BoardService } from "./board.service"

@Controller("boards")
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  // ─── Board CRUD ──────────────────────────────────────────────────────────

  @Post()
  async createBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(createBoardRequestSchema) body: CreateBoardRequest,
  ): Promise<CreateBoardResponse> {
    return this.boardService.createBoard(currentUser, body)
  }

  @Get()
  async listBoards(
    @CurrentUser() currentUser: JwtPayload,
    @ZodQuery(listBoardsQuerySchema) query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    return this.boardService.listBoards(currentUser, query)
  }

  @Get(":boardId")
  async getBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardResponse> {
    return this.boardService.getBoard(currentUser, params.boardId)
  }

  @Patch(":boardId")
  async updateBoardInfo(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(updateBoardInfoRequestSchema) body: UpdateBoardInfoRequest,
  ): Promise<UpdateBoardInfoResponse> {
    return this.boardService.updateBoardInfo(currentUser, params.boardId, body)
  }

  @Patch(":boardId/settings")
  async updateBoardSettings(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(updateBoardSettingsRequestSchema) body: UpdateBoardSettingsRequest,
  ): Promise<UpdateBoardSettingsResponse> {
    return this.boardService.updateBoardSettings(
      currentUser,
      params.boardId,
      body,
    )
  }

  @Delete(":boardId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<void> {
    await this.boardService.deleteBoard(currentUser, params.boardId)
  }

  // ─── Member management ───────────────────────────────────────────────────

  @Get(":boardId/members")
  async getBoardMembers(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardMembersResponse> {
    return this.boardService.getBoardMembers(currentUser, params.boardId)
  }

  @Post(":boardId/members")
  async addBoardMember(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(addBoardMemberRequestSchema) body: AddBoardMemberRequest,
  ): Promise<AddBoardMemberResponse> {
    return this.boardService.addBoardMember(currentUser, params.boardId, body)
  }

  @Patch(":boardId/members/:memberId")
  async updateBoardMemberRole(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardMemberIdParamsSchema) params: BoardMemberIdParams,
    @ZodBody(updateBoardMemberRoleRequestSchema)
    body: UpdateBoardMemberRoleRequest,
  ): Promise<UpdateBoardMemberRoleResponse> {
    return this.boardService.updateBoardMemberRole(
      currentUser,
      params.boardId,
      params.memberId,
      body,
    )
  }

  @Delete(":boardId/members/:memberId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBoardMember(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardMemberIdParamsSchema) params: BoardMemberIdParams,
  ): Promise<void> {
    await this.boardService.removeBoardMember(
      currentUser,
      params.boardId,
      params.memberId,
    )
  }
}
