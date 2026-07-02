import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { ZodBody } from "../../../common/pipes/zod-validation.pipe"
import { BoardInvitationService } from "../service/board-invitation.service"
import {
  createBoardInvitationRequestSchema,
  acceptBoardInvitationRequestSchema,
  type BoardInvitationResponse,
  type CreateBoardInvitationRequest,
  type AcceptBoardInvitationRequest,
  type JwtPayload,
} from "@rctw/shared-contracts"

@Controller()
export class BoardInvitationController {
  constructor(
    private readonly boardInvitationService: BoardInvitationService,
  ) {}

  @Post("boards/:boardId/invitations")
  async createInvitation(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @ZodBody(createBoardInvitationRequestSchema)
    body: CreateBoardInvitationRequest,
  ): Promise<BoardInvitationResponse> {
    return this.boardInvitationService.createInvitation(
      currentUser,
      boardId,
      body,
    )
  }

  @Get("boards/:boardId/invitations")
  async listInvitations(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<BoardInvitationResponse[]> {
    return this.boardInvitationService.listInvitations(currentUser, boardId)
  }

  @Post("invitations/accept")
  async acceptInvitation(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(acceptBoardInvitationRequestSchema)
    body: AcceptBoardInvitationRequest,
  ): Promise<{ boardId: string; role: string }> {
    return this.boardInvitationService.acceptInvitation(currentUser, body)
  }
}
