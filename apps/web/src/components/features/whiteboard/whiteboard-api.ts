import { isAxiosError } from "axios"
import {
  apiErrorSchema,
  type GetRoomOperationsResponse,
  type GetRoomObjectsResponse,
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
} from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"

export async function getRoomObjects(
  roomId: string
): Promise<GetRoomObjectsResponse> {
  const response = await apiClient.get<GetRoomObjectsResponse>(
    `/rooms/${roomId}/objects`
  )

  return response.data
}

export async function getRoomOperations(
  roomId: string,
  limit = 50,
): Promise<GetRoomOperationsResponse> {
  const response = await apiClient.get<GetRoomOperationsResponse>(
    `/rooms/${roomId}/operations`,
    {
      params: {
        limit,
      },
    },
  )

  return response.data
}

export async function createWhiteboardObject(
  roomId: string,
  request: ObjectCreateRequest
): Promise<OperationAppliedEvent> {
  const response = await apiClient.post<OperationAppliedEvent>(
    `/rooms/${roomId}/objects`,
    request
  )

  return response.data
}

export async function updateWhiteboardObject(
  roomId: string,
  objectId: string,
  request: ObjectUpdateRequest
): Promise<OperationAppliedEvent> {
  const response = await apiClient.patch<OperationAppliedEvent>(
    `/rooms/${roomId}/objects/${objectId}`,
    request
  )

  return response.data
}

export async function deleteWhiteboardObject(
  roomId: string,
  objectId: string,
  request: ObjectDeleteRequest
): Promise<OperationAppliedEvent> {
  const response = await apiClient.delete<OperationAppliedEvent>(
    `/rooms/${roomId}/objects/${objectId}`,
    {
      data: request,
    }
  )

  return response.data
}

export function getWhiteboardApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const parsed = apiErrorSchema.safeParse(error.response?.data)

    if (parsed.success) {
      return parsed.data.message
    }
  }

  return "Whiteboard request failed."
}
