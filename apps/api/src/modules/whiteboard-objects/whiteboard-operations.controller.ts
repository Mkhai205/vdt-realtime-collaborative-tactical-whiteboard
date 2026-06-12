import { Controller, Get, UseGuards } from "@nestjs/common"
import {
  getRoomOperationsQuerySchema,
  roomIdParamsSchema,
  type GetRoomOperationsQuery,
  type GetRoomOperationsResponse,
  type RoomIdParams,
  type UserSummary,
} from "@rctw/shared-contracts"
import { ZodParam, ZodQuery } from "../../common/pipes"
import { CurrentUser, IdentityGuard } from "../identity"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Controller("rooms/:roomId/operations")
@UseGuards(IdentityGuard)
export class WhiteboardOperationsController {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
  ) {}

  @Get()
  async getRoomOperations(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
    @ZodQuery(getRoomOperationsQuerySchema) query: GetRoomOperationsQuery,
  ): Promise<GetRoomOperationsResponse> {
    return this.whiteboardObjectsService.getRoomOperations(
      currentUser,
      params.roomId,
      query,
    )
  }
}
