import { Controller, Delete, Get, Patch, Post, UseGuards } from "@nestjs/common"
import {
  boardIdParamsSchema,
  objectCreateRequestSchema,
  objectDeleteRequestSchema,
  objectUpdateRequestSchema,
  whiteboardObjectParamsSchema,
  type BoardIdParams,
  type GetBoardObjectsResponse,
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
  type UserSummary,
  type WhiteboardObjectParams,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodBody, ZodParam } from "../../common/pipes"
import { AuthGuard } from "../auth/guards/auth.guard"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Controller("boards/:boardId/objects")
@UseGuards(AuthGuard)
export class WhiteboardObjectsController {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
  ) {}

  @Get()
  async getBoardObjects(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
  ): Promise<GetBoardObjectsResponse> {
    return this.whiteboardObjectsService.getBoardObjects(
      currentUser,
      params.boardId,
    )
  }

  @Post()
  async createObject(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(boardIdParamsSchema) params: BoardIdParams,
    @ZodBody(objectCreateRequestSchema) request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.createObject(
      currentUser,
      params.boardId,
      request,
    )
  }

  @Patch(":objectId")
  async updateObject(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(whiteboardObjectParamsSchema)
    params: WhiteboardObjectParams,
    @ZodBody(objectUpdateRequestSchema) request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.updateObject(
      currentUser,
      params.boardId,
      params.objectId,
      request,
    )
  }

  @Delete(":objectId")
  async deleteObject(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(whiteboardObjectParamsSchema)
    params: WhiteboardObjectParams,
    @ZodBody(objectDeleteRequestSchema) request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.deleteObject(
      currentUser,
      params.boardId,
      params.objectId,
      request,
    )
  }
}
