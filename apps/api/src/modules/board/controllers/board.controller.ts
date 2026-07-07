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
  createBoardRequestSchema,
  listBoardsQuerySchema,
  updateBoardInfoRequestSchema,
  updateBoardSettingsRequestSchema,
  importBoardRequestSchema,
  importBoardObjectsRequestSchema,
  type BoardDetailResponse,
  type BoardResponse,
  type CreateBoardRequest,
  type JwtPayload,
  type ListBoardsQuery,
  type ListBoardsResponse,
  type UpdateBoardInfoRequest,
  type UpdateBoardSettingsRequest,
  type ImportBoardRequest,
  type ImportBoardObjectsRequest,
  type BoardObjectsResponse,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { Public } from "../../../common/decorators/public.decorator"
import { ZodBody, ZodQuery } from "../../../common/pipes"
import { BoardService } from "../service/board.service"

@Controller("boards")
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post()
  async createBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(createBoardRequestSchema) body: CreateBoardRequest,
  ): Promise<BoardResponse> {
    return this.boardService.createBoard(currentUser, body)
  }

  @Get()
  async listBoards(
    @CurrentUser() currentUser: JwtPayload,
    @ZodQuery(listBoardsQuerySchema) query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    return this.boardService.listBoards(currentUser, query)
  }

  @Public()
  @Get(":boardId")
  async getBoard(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<BoardDetailResponse> {
    return this.boardService.getBoard(currentUser, boardId)
  }

  @Patch(":boardId")
  async updateBoardInfo(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodBody(updateBoardInfoRequestSchema) body: UpdateBoardInfoRequest,
  ): Promise<BoardResponse> {
    return this.boardService.updateBoardInfo(currentUser, boardId, body)
  }

  @Patch(":boardId/settings")
  async updateBoardSettings(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodBody(updateBoardSettingsRequestSchema) body: UpdateBoardSettingsRequest,
  ): Promise<BoardResponse> {
    return this.boardService.updateBoardSettings(currentUser, boardId, body)
  }

  @Delete(":boardId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBoard(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<void> {
    await this.boardService.deleteBoard(currentUser, boardId)
  }

  @Post("import")
  async importBoard(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(importBoardRequestSchema) body: ImportBoardRequest,
  ): Promise<BoardResponse> {
    return this.boardService.importBoard(currentUser, body)
  }

  @Post(":boardId/import")
  async importBoardObjects(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodBody(importBoardObjectsRequestSchema) body: ImportBoardObjectsRequest,
  ): Promise<BoardObjectsResponse> {
    return this.boardService.importBoardObjects(currentUser, boardId, body)
  }
}
