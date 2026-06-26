import { type UpdateProfileRequest, type UpdateProfileResponse } from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"

export async function updateProfile(
  request: UpdateProfileRequest
): Promise<UpdateProfileResponse> {
  const response = await apiClient.patch<UpdateProfileResponse>("/users/me", request)

  return response.data
}

