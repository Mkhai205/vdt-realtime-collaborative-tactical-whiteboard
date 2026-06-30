import { z } from "zod"

export const ErrorCodes = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BOARD_NOT_FOUND: "BOARD_NOT_FOUND",
  OBJECT_NOT_FOUND: "OBJECT_NOT_FOUND",
  OBJECT_ALREADY_DELETED: "OBJECT_ALREADY_DELETED",
  OBJECT_VERSION_CONFLICT: "OBJECT_VERSION_CONFLICT",
  DUPLICATE_OPERATION: "DUPLICATE_OPERATION",
  INVALID_OPERATION_PAYLOAD: "INVALID_OPERATION_PAYLOAD",
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  OBJECT_LOCKED: "OBJECT_LOCKED",
  CONFLICT: "CONFLICT",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

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

export interface ErrorResponse {
  success: false
  statusCode: number
  code: string
  message: string
  errors?: string[]
  timestamp: string
  path: string
}
