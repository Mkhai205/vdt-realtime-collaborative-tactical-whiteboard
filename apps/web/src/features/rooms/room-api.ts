import { isAxiosError } from "axios"
import {
  apiErrorSchema,
  type AddRoomMemberRequest,
  type GetRoomMembersResponse,
  type GetRoomResponse,
  type RoomMemberMutationResponse,
  type UpdateRoomMemberRoleRequest,
} from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"

export async function getRoom(roomId: string): Promise<GetRoomResponse> {
  const response = await apiClient.get<GetRoomResponse>(`/rooms/${roomId}`)

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

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const parsed = apiErrorSchema.safeParse(error.response?.data)

    if (parsed.success) {
      return parsed.data.message
    }
  }

  return "Request failed."
}
