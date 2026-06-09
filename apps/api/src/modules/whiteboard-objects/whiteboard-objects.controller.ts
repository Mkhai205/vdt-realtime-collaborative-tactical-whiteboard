import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  objectCreateRequestSchema,
  objectDeleteRequestSchema,
  objectUpdateRequestSchema,
  roomIdParamsSchema,
  whiteboardObjectParamsSchema,
  type GetRoomObjectsResponse,
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
  type RoomIdParams,
  type UserSummary,
  type WhiteboardObjectParams,
} from "@rctw/shared-contracts"
import { ZodBody, ZodValidationPipe } from "../../common/pipes"
import { CurrentUser, IdentityGuard } from "../identity"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Controller("rooms/:roomId/objects")
@UseGuards(IdentityGuard)
export class WhiteboardObjectsController {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
  ) {}

  @Get()
  async getRoomObjects(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
  ): Promise<GetRoomObjectsResponse> {
    return this.whiteboardObjectsService.getRoomObjects(
      currentUser,
      params.roomId,
    )
  }

  @Post()
  async createObject(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
    @ZodBody(objectCreateRequestSchema) request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.createObject(
      currentUser,
      params.roomId,
      request,
    )
  }

  @Patch(":objectId")
  async updateObject(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(whiteboardObjectParamsSchema))
    params: WhiteboardObjectParams,
    @ZodBody(objectUpdateRequestSchema) request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.updateObject(
      currentUser,
      params.roomId,
      params.objectId,
      request,
    )
  }

  @Delete(":objectId")
  async deleteObject(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(whiteboardObjectParamsSchema))
    params: WhiteboardObjectParams,
    @Body(new ZodValidationPipe(objectDeleteRequestSchema))
    request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.deleteObject(
      currentUser,
      params.roomId,
      params.objectId,
      request,
    )
  }
}
