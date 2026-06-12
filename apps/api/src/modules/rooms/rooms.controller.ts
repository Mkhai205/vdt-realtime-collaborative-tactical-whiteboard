import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  addRoomMemberRequestSchema,
  createRoomRequestSchema,
  listRoomsQuerySchema,
  roomMemberIdParamsSchema,
  roomIdParamsSchema,
  updateRoomMemberRoleRequestSchema,
  updateRoomRequestSchema,
  type AddRoomMemberRequest,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type GetRoomMembersResponse,
  type GetRoomResponse,
  type JoinRoomResponse,
  type ListRoomsQuery,
  type ListRoomsResponse,
  type RoomMemberIdParams,
  type RoomMemberMutationResponse,
  type RoomIdParams,
  type UpdateRoomMemberRoleRequest,
  type UpdateRoomRequest,
  type UpdateRoomResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import { ZodBody, ZodParam, ZodQuery } from "../../common/pipes"
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
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
  ): Promise<GetRoomResponse> {
    return this.roomsService.getRoom(currentUser, params.roomId)
  }

  @Post(":roomId/join")
  async joinRoom(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
  ): Promise<JoinRoomResponse> {
    return this.roomsService.joinRoom(currentUser, params.roomId)
  }

  @Get(":roomId/members")
  async getRoomMembers(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
  ): Promise<GetRoomMembersResponse> {
    return this.roomsService.getRoomMembers(currentUser, params.roomId)
  }

  @Post(":roomId/members")
  async addRoomMember(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
    @ZodBody(addRoomMemberRequestSchema) request: AddRoomMemberRequest,
  ): Promise<RoomMemberMutationResponse> {
    return this.roomsService.addRoomMember(currentUser, params.roomId, request)
  }

  @Patch(":roomId/members/:memberId")
  async updateRoomMemberRole(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomMemberIdParamsSchema) params: RoomMemberIdParams,
    @ZodBody(updateRoomMemberRoleRequestSchema)
    request: UpdateRoomMemberRoleRequest,
  ): Promise<RoomMemberMutationResponse> {
    return this.roomsService.updateRoomMemberRole(
      currentUser,
      params.roomId,
      params.memberId,
      request,
    )
  }

  @Patch(":roomId")
  async updateRoom(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
    @ZodBody(updateRoomRequestSchema) request: UpdateRoomRequest,
  ): Promise<UpdateRoomResponse> {
    return this.roomsService.updateRoom(currentUser, params.roomId, request)
  }

  @Delete(":roomId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @CurrentUser() currentUser: UserSummary,
    @ZodParam(roomIdParamsSchema) params: RoomIdParams,
  ): Promise<void> {
    await this.roomsService.deleteRoom(currentUser, params.roomId)
  }
}
