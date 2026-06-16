import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  addBoardMemberRequestSchema,
  boardIdParamsSchema,
  boardMemberIdParamsSchema,
  createBoardRequestSchema,
  listBoardsQuerySchema,
  updateBoardMemberRoleRequestSchema,
  updateBoardRequestSchema,
  type AddBoardMemberRequest,
  type BoardIdParams,
  type BoardMemberIdParams,
  type BoardMemberMutationResponse,
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
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { ZodBody, ZodParam, ZodQuery } from "../../../common/pipes"
import { AuthGuard } from "../../auth/guards/auth.guard"
import { BoardService } from "../services/board.service"

@Controller("boards")
@UseGuards(AuthGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post()
  async createBoard(
    @CurrentUser() currentUser: UserSummary,
    @ZodBody(createBoardRequestSchema) request: CreateBoardRequest,
  ): Promise<CreateBoardResponse> {
    return this.boardService.createBoard(currentUser, request)
  }

  @Get()
  async listBoards(
    @CurrentUser() currentUser: UserSummary,
    @ZodQuery(listBoardsQuerySchema) query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    return this.boardService.listBoards(currentUser, query)
  }

  @Get(":boardId")
  async getBoard(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardResponse> {
    return this.boardService.getBoard(currentUser, params.boardId)
  }

  @Post(":boardId/join")
  async joinBoard(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<JoinBoardResponse> {
    return this.boardService.joinBoard(currentUser, params.boardId)
  }

  @Get(":boardId/members")
  async getBoardMembers(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardMembersResponse> {
    return this.boardService.getBoardMembers(currentUser, params.boardId)
  }

  @Post(":boardId/members")
  async addBoardMember(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(addBoardMemberRequestSchema) request: AddBoardMemberRequest,
  ): Promise<BoardMemberMutationResponse> {
    return this.boardService.addBoardMember(
      currentUser,
      params.boardId,
      request,
    )
  }

  @Patch(":boardId/members/:memberId")
  async updateBoardMemberRole(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardMemberIdParamsSchema) params: BoardMemberIdParams,
    @ZodBody(updateBoardMemberRoleRequestSchema)
    request: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberMutationResponse> {
    return this.boardService.updateBoardMemberRole(
      currentUser,
      params.boardId,
      params.memberId,
      request,
    )
  }

  @Patch(":boardId")
  async updateBoard(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(updateBoardRequestSchema) request: UpdateBoardRequest,
  ): Promise<UpdateBoardResponse> {
    return this.boardService.updateBoard(currentUser, params.boardId, request)
  }

  @Delete(":boardId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBoard(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<void> {
    await this.boardService.deleteBoard(currentUser, params.boardId)
  }
}
