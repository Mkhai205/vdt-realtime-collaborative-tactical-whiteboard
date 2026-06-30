import { z } from "zod"
import { PaginatedResponse, PaginationQuerySchema } from "./common"
import { emailSchema, nameSchema, UserSummary } from "./user"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const avatarPalette = [
  "#3B82F6",
  "#16A34A",
  "#DC2626",
  "#D97706",
  "#7C3AED",
  "#0891B2",
  "#BE123C",
  "#4F46E5",
] as const

export const boardRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"])
export type BoardRole = z.infer<typeof boardRoleSchema>
export const boardRoles = boardRoleSchema.enum

export const effectiveBoardRoleSchema = z.enum([
  "OWNER",
  "EDITOR",
  "VIEWER",
  "PUBLIC_VIEWER",
])
export type EffectiveBoardRole = z.infer<typeof effectiveBoardRoleSchema>
export const effectiveBoardRoles = effectiveBoardRoleSchema.enum

export const boardVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"])
export type BoardVisibility = z.infer<typeof boardVisibilitySchema>
export const boardVisibility = boardVisibilitySchema.enum

// ─── Params / Query schemas ───────────────────────────────────────────────────

export const boardIdParamsSchema = z.object({
  boardId: z.uuid(),
})
export type BoardIdParams = z.infer<typeof boardIdParamsSchema>

export const boardMemberIdParamsSchema = boardIdParamsSchema.extend({
  memberId: z.uuid(),
})
export type BoardMemberIdParams = z.infer<typeof boardMemberIdParamsSchema>

export const listBoardsQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
})
export type ListBoardsQuery = z.infer<typeof listBoardsQuerySchema>

// ─── Request schemas ──────────────────────────────────────────────────────────

export const createBoardRequestSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(500).nullable(),
  visibility: boardVisibilitySchema.default("PRIVATE"),
})
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>

export const updateBoardInfoRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field (name or description) is required.",
  })
export type UpdateBoardInfoRequest = z.infer<
  typeof updateBoardInfoRequestSchema
>

export const updateBoardSettingsRequestSchema = z
  .object({
    visibility: boardVisibilitySchema,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field (visibility or linkAccess) is required.",
  })
export type UpdateBoardSettingsRequest = z.infer<
  typeof updateBoardSettingsRequestSchema
>

export const addBoardMemberRequestSchema = z.object({
  email: emailSchema,
  role: z.enum(["EDITOR", "VIEWER"]),
})
export type AddBoardMemberRequest = z.infer<typeof addBoardMemberRequestSchema>

export const updateBoardMemberRoleRequestSchema = z.object({
  role: boardRoleSchema,
})
export type UpdateBoardMemberRoleRequest = z.infer<
  typeof updateBoardMemberRoleRequestSchema
>

// ─── Response types ───────────────────────────────────────────────────────────

export type BoardSummary = {
  id: string
  name: string
  description: string | null
  visibility: BoardVisibility
  currentRevision: number
  createdBy: UserSummary
  createdAt: Date
  updatedAt: Date
}
export type BoardMemberSummary = {
  id: string
  role: BoardRole
  joinedAt: Date
  user: UserSummary
}

export type CreateBoardResponse = BoardSummary
export type ListBoardsResponse = PaginatedResponse<BoardSummary>
export type GetBoardResponse = BoardSummary & {
  effectiveRole: EffectiveBoardRole
}
export type UpdateBoardInfoResponse = BoardSummary
export type UpdateBoardSettingsResponse = BoardSummary
export type GetBoardMembersResponse = BoardMemberSummary[]
export type AddBoardMemberResponse = BoardMemberSummary
export type UpdateBoardMemberRoleResponse = BoardMemberSummary
