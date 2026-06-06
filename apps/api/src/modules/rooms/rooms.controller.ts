import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  createRoomRequestSchema,
  listRoomsQuerySchema,
  roomIdParamsSchema,
  updateRoomRequestSchema,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type GetRoomMembersResponse,
  type GetRoomResponse,
  type JoinRoomResponse,
  type ListRoomsQuery,
  type ListRoomsResponse,
  type RoomIdParams,
  type UpdateRoomRequest,
  type UpdateRoomResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import { ZodBody, ZodQuery, ZodValidationPipe } from "../../common/pipes"
import { CurrentUser, IdentityGuard } from "../identity"
import { RoomsService } from "./rooms.service"

@Controller("rooms")
@UseGuards(IdentityGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  async createRoom(
    @CurrentUser() currentUser: UserSummary,
    @ZodBody(createRoomRequestSchema) request: CreateRoomRequest,
  ): Promise<CreateRoomResponse> {
    return this.roomsService.createRoom(currentUser, request)
  }

  @Get()
  async listRooms(
    @CurrentUser() currentUser: UserSummary,
    @ZodQuery(listRoomsQuerySchema) query: ListRoomsQuery,
  ): Promise<ListRoomsResponse> {
    return this.roomsService.listRooms(currentUser, query)
  }

  @Get(":roomId")
  async getRoom(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
  ): Promise<GetRoomResponse> {
    return this.roomsService.getRoom(currentUser, params.roomId)
  }

  @Post(":roomId/join")
  async joinRoom(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
  ): Promise<JoinRoomResponse> {
    return this.roomsService.joinRoom(currentUser, params.roomId)
  }

  @Get(":roomId/members")
  async getRoomMembers(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
  ): Promise<GetRoomMembersResponse> {
    return this.roomsService.getRoomMembers(currentUser, params.roomId)
  }

  @Patch(":roomId")
  async updateRoom(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
    @ZodBody(updateRoomRequestSchema) request: UpdateRoomRequest,
  ): Promise<UpdateRoomResponse> {
    return this.roomsService.updateRoom(currentUser, params.roomId, request)
  }

  @Delete(":roomId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @CurrentUser() currentUser: UserSummary,
    @Param(new ZodValidationPipe(roomIdParamsSchema)) params: RoomIdParams,
  ): Promise<void> {
    await this.roomsService.deleteRoom(currentUser, params.roomId)
  }
}
