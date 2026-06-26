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
  updateBoardMemberRoleRequestSchema,
  updateBoardRequestSchema,
  type JwtPayload,
  type AddBoardMemberRequest,
  type BoardIdParams,
  type BoardMemberIdParams,
  type BoardMemberMutationResponse,
  type CreateBoardRequest,
  type CreateBoardResponse,
  type GetBoardMembersResponse,
  type GetBoardResponse,
  type ListBoardsQuery,
  type ListBoardsResponse,
  type UpdateBoardMemberRoleRequest,
  type UpdateBoardRequest,
  type UpdateBoardResponse,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodBody, ZodParam, ZodQuery } from "../../common/pipes"
import { BoardService } from "./board.service"

@Controller("boards")
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post()
  async createBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(createBoardRequestSchema) request: CreateBoardRequest,
  ): Promise<CreateBoardResponse> {
    return this.boardService.createBoard(currentUser, request)
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

  @Post(":boardId/join")
  async joinBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardResponse> {
    return this.boardService.joinBoard(currentUser, params.boardId)
  }

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
    @ZodBody(addBoardMemberRequestSchema) request: AddBoardMemberRequest,
  ): Promise<BoardMemberMutationResponse> {
    const member = await this.boardService.addBoardMember(
      currentUser,
      params.boardId,
      request,
    )
    return { member }
  }

  @Patch(":boardId/members/:memberId")
  async updateBoardMemberRole(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardMemberIdParamsSchema) params: BoardMemberIdParams,
    @ZodBody(updateBoardMemberRoleRequestSchema)
    request: UpdateBoardMemberRoleRequest,
  ): Promise<BoardMemberMutationResponse> {
    const member = await this.boardService.updateBoardMemberRole(
      currentUser,
      params.boardId,
      params.memberId,
      request,
    )
    return { member }
  }

  @Patch(":boardId")
  async updateBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(updateBoardRequestSchema) request: UpdateBoardRequest,
  ): Promise<UpdateBoardResponse> {
    return this.boardService.updateBoard(currentUser, params.boardId, request)
  }

  @Delete(":boardId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<void> {
    await this.boardService.deleteBoard(currentUser, params.boardId)
  }
}
