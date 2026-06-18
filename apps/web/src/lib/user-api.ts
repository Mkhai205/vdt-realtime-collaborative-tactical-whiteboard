import { type UpdateProfileRequest, type UserSummary } from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"

export async function updateProfile(
  request: UpdateProfileRequest
): Promise<UserSummary> {
  const response = await apiClient.patch<UserSummary>("/users/me", request)

  return response.data
}
