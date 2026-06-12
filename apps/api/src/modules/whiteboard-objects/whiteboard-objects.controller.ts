import { Controller, Delete, Get, Patch, Post, UseGuards } from "@nestjs/common"
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
import { ZodBody, ZodParam } from "../../common/pipes"
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
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
  ): Promise<GetRoomObjectsResponse> {
    return this.whiteboardObjectsService.getRoomObjects(
      currentUser,
      params.roomId,
    )
  }

  @Post()
  async createObject(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
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
    @ZodParam(whiteboardObjectParamsSchema)
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
    @ZodParam(whiteboardObjectParamsSchema)
    params: WhiteboardObjectParams,
    @ZodBody(objectDeleteRequestSchema) request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.whiteboardObjectsService.deleteObject(
      currentUser,
      params.roomId,
      params.objectId,
      request,
    )
  }
}
