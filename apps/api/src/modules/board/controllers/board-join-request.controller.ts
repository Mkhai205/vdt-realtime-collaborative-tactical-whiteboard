import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common"
import {
  respondJoinRequestSchema,
  type RespondJoinRequest,
  type JwtPayload,
  type UserSummary,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { ZodBody } from "../../../common/pipes/zod-validation.pipe"
import { BoardJoinRequestService } from "../service/board-join-request.service"

@Controller("boards/:boardId/join-requests")
export class BoardJoinRequestController {
  constructor(private readonly joinRequestService: BoardJoinRequestService) {}

  @Post()
  async createJoinRequest(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<{ id: string; boardId: string; status: string; createdAt: Date }> {
    return this.joinRequestService.createJoinRequest(currentUser, boardId)
  }

  @Get()
  async listJoinRequests(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<
    Array<{
      id: string
      boardId: string
      status: string
      createdAt: Date
      user: UserSummary
    }>
  > {
    return this.joinRequestService.listJoinRequests(currentUser, boardId)
  }

  @Patch(":requestId")
  async respondToJoinRequest(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @ZodBody(respondJoinRequestSchema) body: RespondJoinRequest,
  ): Promise<{ id: string; boardId: string; status: string; userId: string }> {
    return this.joinRequestService.respondToJoinRequest(
      currentUser,
      boardId,
      requestId,
      body,
    )
  }
}
