import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common"
import {
  boardOperationsQuerySchema,
  type BoardObjectsResponse,
  type BoardOperationsResponse,
  type BoardOperationsQuery,
  type JwtPayload,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { ZodQuery } from "../../../common/pipes/zod-validation.pipe"
import { WhiteboardQueryService } from "../service/board-operation.service"

@Controller("boards/:boardId")
export class BoardDataController {
  constructor(
    private readonly whiteboardQueryService: WhiteboardQueryService,
  ) {}

  @Get("objects")
  async getBoardObjects(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<BoardObjectsResponse> {
    return this.whiteboardQueryService.getBoardObjects(currentUser, boardId)
  }

  @Get("operations")
  async getBoardOperations(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodQuery(boardOperationsQuerySchema) query: BoardOperationsQuery,
  ): Promise<BoardOperationsResponse> {
    return this.whiteboardQueryService.getBoardOperationReplay(
      currentUser,
      boardId,
      query,
    )
  }
}
