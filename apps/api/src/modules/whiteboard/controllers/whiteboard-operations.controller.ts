/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Controller, Get, UseGuards } from "@nestjs/common"
import {
  boardIdParamsSchema,
  getBoardOperationsQuerySchema,
  type BoardIdParams,
  type GetBoardOperationsQuery,
  type GetBoardOperationsResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { ZodParam, ZodQuery } from "../../../common/pipes"
import { AuthGuard } from "../../auth/guards/auth.guard"
import { WhiteboardObjectsService } from "../services/whiteboard-objects.service"

@Controller("boards/:boardId/operations")
@UseGuards(AuthGuard)
export class WhiteboardOperationsController {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
  ) {}

  @Get()
  async getBoardOperations(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodQuery(getBoardOperationsQuerySchema) query: GetBoardOperationsQuery,
  ): Promise<GetBoardOperationsResponse> {
    return this.whiteboardObjectsService.getBoardOperations(
      currentUser,
      params.boardId,
      query,
    )
  }
}
