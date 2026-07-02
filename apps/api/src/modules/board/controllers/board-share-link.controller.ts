import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { ZodBody } from "../../../common/pipes/zod-validation.pipe"
import { BoardShareLinkService } from "../service/board-share-link.service"
import {
  createBoardShareLinkRequestSchema,
  joinBoardByLinkRequestSchema,
  type BoardShareLinkResponse,
  type CreateBoardShareLinkRequest,
  type JoinBoardByLinkRequest,
  type JwtPayload,
} from "@rctw/shared-contracts"

@Controller("boards")
export class BoardShareLinkController {
  constructor(private readonly boardShareLinkService: BoardShareLinkService) {}

  @Get(":boardId/share-links")
  async listShareLinks(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<BoardShareLinkResponse[]> {
    return this.boardShareLinkService.listShareLinks(currentUser, boardId)
  }

  @Post(":boardId/share-links")
  async createShareLink(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodBody(createBoardShareLinkRequestSchema)
    body: CreateBoardShareLinkRequest,
  ): Promise<BoardShareLinkResponse> {
    return this.boardShareLinkService.createShareLink(
      currentUser,
      boardId,
      body,
    )
  }

  @Delete(":boardId/share-links/:linkId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShareLink(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
  ): Promise<void> {
    await this.boardShareLinkService.revokeShareLink(
      currentUser,
      boardId,
      linkId,
    )
  }

  @Post("join")
  async joinBoardByLink(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(joinBoardByLinkRequestSchema) body: JoinBoardByLinkRequest,
  ): Promise<{ boardId: string; role: string }> {
    return this.boardShareLinkService.joinBoardByLink(currentUser, body)
  }
}
