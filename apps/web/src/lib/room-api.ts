import {
  type AddRoomMemberRequest,
  type GetRoomMembersResponse,
  type GetRoomResponse,
  type JoinRoomResponse,
  type RoomMemberMutationResponse,
  type UpdateRoomMemberRoleRequest,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type ListRoomsResponse,
} from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"

export { getApiErrorMessage } from "@/lib/api-error-utils"

export async function createRoom(
  request: CreateRoomRequest
): Promise<CreateRoomResponse> {
  const response = await apiClient.post<CreateRoomResponse>("/rooms", request)

  return response.data
}

export async function listRooms(): Promise<ListRoomsResponse> {
  const response = await apiClient.get<ListRoomsResponse>("/rooms")

  return response.data
}

export async function getRoom(roomId: string): Promise<GetRoomResponse> {
  const response = await apiClient.get<GetRoomResponse>(`/rooms/${roomId}`)

  return response.data
}

export async function joinRoom(roomId: string): Promise<JoinRoomResponse> {
  const response = await apiClient.post<JoinRoomResponse>(
    `/rooms/${roomId}/join`
  )

  return response.data
}

export async function getRoomMembers(
  roomId: string
): Promise<GetRoomMembersResponse> {
  const response = await apiClient.get<GetRoomMembersResponse>(
    `/rooms/${roomId}/members`
  )

  return response.data
}

export async function addRoomMember(
  roomId: string,
  request: AddRoomMemberRequest
): Promise<RoomMemberMutationResponse> {
  const response = await apiClient.post<RoomMemberMutationResponse>(
    `/rooms/${roomId}/members`,
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
    `/rooms/${roomId}/members/${memberId}`,
    request
  )

  return response.data
}
