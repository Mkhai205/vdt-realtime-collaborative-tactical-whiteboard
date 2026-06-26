import { Controller, Get } from "@nestjs/common"
import {
  boardIdParamsSchema,
  getBoardOperationsQuerySchema,
  type GetBoardOperationsResponse,
  type GetBoardOperationsQuery,
  type GetBoardObjectsResponse,
  type BoardIdParams,
  type JwtPayload,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodParam, ZodQuery } from "../../common/pipes"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Controller("boards")
export class WhiteboardController {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
  ) {}

  @Get(":boardId/operations")
  async getBoardOperations(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodQuery(getBoardOperationsQuerySchema) query: GetBoardOperationsQuery,
  ): Promise<GetBoardOperationsResponse> {
    return this.whiteboardObjectsService.getBoardOperations(
      currentUser,
      params.boardId,
      query,
    )
  }

  @Get(":boardId/objects")
  async getBoardObjects(
    @CurrentUser() currentUser: JwtPayload,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardObjectsResponse> {
    return this.whiteboardObjectsService.getBoardObjects(
      currentUser,
      params.boardId,
    )
  }
}
