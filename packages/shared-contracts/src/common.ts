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

export const userSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  avatarUrl: z.url().nullable().optional(),
  avatarColor: z.string().min(1).max(20).nullable().optional(),
})

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
export type UserSummary = z.infer<typeof userSummarySchema>
