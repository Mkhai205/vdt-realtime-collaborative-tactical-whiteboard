import {
  type GetBoardOperationsResponse,
  type GetBoardObjectsResponse,
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
} from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"
import { getApiErrorMessage } from "@/lib/api-error-utils"

export async function getRoomObjects(
  roomId: string,
): Promise<GetBoardObjectsResponse> {
  const response = await apiClient.get<GetBoardObjectsResponse>(
    `/rooms/${roomId}/objects`,
  )

  return response.data
}

export async function getRoomOperations(
  roomId: string,
  limit = 50,
): Promise<GetBoardOperationsResponse> {
  const response = await apiClient.get<GetBoardOperationsResponse>(
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
  request: ObjectCreateRequest,
): Promise<OperationAppliedEvent> {
  const response = await apiClient.post<OperationAppliedEvent>(
    `/rooms/${roomId}/objects`,
    request,
  )

  return response.data
}

export async function updateWhiteboardObject(
  roomId: string,
  objectId: string,
  request: ObjectUpdateRequest,
): Promise<OperationAppliedEvent> {
  const response = await apiClient.patch<OperationAppliedEvent>(
    `/rooms/${roomId}/objects/${objectId}`,
    request,
  )

  return response.data
}

export async function deleteWhiteboardObject(
  roomId: string,
  objectId: string,
  request: ObjectDeleteRequest,
): Promise<OperationAppliedEvent> {
  const response = await apiClient.delete<OperationAppliedEvent>(
    `/rooms/${roomId}/objects/${objectId}`,
    {
      data: request,
    },
  )

  return response.data
}

export function getWhiteboardApiErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, "Whiteboard request failed.")
}
