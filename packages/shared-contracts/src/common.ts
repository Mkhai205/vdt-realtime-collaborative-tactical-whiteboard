import { z } from "zod"

export const apiErrorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "USER_NOT_FOUND",
  "PERMISSION_DENIED",
  "VALIDATION_ERROR",
  "BOARD_NOT_FOUND",
  "OBJECT_NOT_FOUND",
  "OBJECT_ALREADY_DELETED",
  "OBJECT_VERSION_CONFLICT",
  "DUPLICATE_OPERATION",
  "INVALID_OPERATION_PAYLOAD",
  "MEMBER_NOT_FOUND",
  "INTERNAL_ERROR",
])
export const apiErrorCodes = apiErrorCodeSchema.enum

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
})

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export type PaginatedResponse<T> = {
  items: T[]
  meta: {
    total: number
    page?: number
    limit?: number
  }
}

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
