import { isAxiosError } from "axios"
import { apiErrorSchema } from "@rctw/shared-contracts"

/**
 * Shared API error message extraction.
 * Centralized from room-api and whiteboard-api.
 */
export function getApiErrorMessage(
  error: unknown,
  fallbackMessage = "Request failed.",
): string {
  if (isAxiosError(error)) {
    const parsed = apiErrorSchema.safeParse(error.response?.data)

    if (parsed.success) {
      return parsed.data.message
    }
  }

  return fallbackMessage
}
