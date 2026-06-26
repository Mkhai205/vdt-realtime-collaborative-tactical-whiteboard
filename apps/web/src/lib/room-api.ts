import {
  type AddBoardMemberRequest as AddRoomMemberRequest,
  type GetBoardMembersResponse as GetRoomMembersResponse,
  type GetBoardResponse as GetRoomResponse,
  type GetBoardResponse as JoinRoomResponse,
  type BoardMemberMutationResponse as RoomMemberMutationResponse,
  type UpdateBoardMemberRoleRequest as UpdateRoomMemberRoleRequest,
  type CreateBoardRequest as CreateRoomRequest,
  type CreateBoardResponse as CreateRoomResponse,
  type ListBoardsResponse as ListRoomsResponse,
} from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"

export { getApiErrorMessage } from "@/lib/api-error-utils"

export async function createRoom(
  request: CreateRoomRequest
): Promise<CreateRoomResponse> {
  const response = await apiClient.post<CreateRoomResponse>("/boards", request)

  return response.data
}

export async function listRooms(): Promise<ListRoomsResponse> {
  const response = await apiClient.get<ListRoomsResponse>("/boards")

  return response.data
}

export async function getRoom(roomId: string): Promise<GetRoomResponse> {
  const response = await apiClient.get<GetRoomResponse>(`/boards/${roomId}`)

  return response.data
}

export async function joinRoom(roomId: string): Promise<JoinRoomResponse> {
  const response = await apiClient.post<JoinRoomResponse>(
    `/boards/${roomId}/join`
  )

  return response.data
}

export async function getRoomMembers(
  roomId: string
): Promise<GetRoomMembersResponse> {
  const response = await apiClient.get<GetRoomMembersResponse>(
    `/boards/${roomId}/members`
  )

  return response.data
}

export async function addRoomMember(
  roomId: string,
  request: AddRoomMemberRequest
): Promise<RoomMemberMutationResponse> {
  const response = await apiClient.post<RoomMemberMutationResponse>(
    `/boards/${roomId}/members`,
    request
  )

  return response.data
}

export async function updateRoomMemberRole(
  roomId: string,
  memberId: string,
  request: UpdateRoomMemberRoleRequest
): Promise<RoomMemberMutationResponse> {
  const response = await apiClient.patch<RoomMemberMutationResponse>(
    `/boards/${roomId}/members/${memberId}`,
    request
  )

  return response.data
}
