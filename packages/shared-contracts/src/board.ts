import { z } from "zod"
import { PaginatedResponse, PaginationQuerySchema } from "./common"
import { UserSummary } from "./user"

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
export const boardRoles = boardRoleSchema.enum
export type BoardRole = z.infer<typeof boardRoleSchema>

export const defaultJoinRoleSchema = z.enum(["EDITOR", "VIEWER"])
export type DefaultJoinRole = z.infer<typeof defaultJoinRoleSchema>
export const memberRoleInputSchema = z.enum(["EDITOR", "VIEWER"])
export type MemberRoleInput = z.infer<typeof memberRoleInputSchema>

export const boardIdParamsSchema = z.object({
  boardId: z.uuid(),
})
export type BoardIdParams = z.infer<typeof boardIdParamsSchema>

export const boardMemberIdParamsSchema = boardIdParamsSchema.extend({
  memberId: z.uuid(),
})
export type BoardMemberIdParams = z.infer<typeof boardMemberIdParamsSchema>

export const updateBoardMemberRoleRequestSchema = boardRoleSchema
export type UpdateBoardMemberRoleRequest = z.infer<
  typeof updateBoardMemberRoleRequestSchema
>

export const createBoardRequestSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  isPublic: z.boolean().default(true),
  defaultJoinRole: defaultJoinRoleSchema.default("EDITOR"),
})
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>

export const listBoardsQuerySchema = PaginationQuerySchema
export type ListBoardsQuery = z.infer<typeof listBoardsQuerySchema>

export const addBoardMemberRequestSchema = z.object({
  userId: z.uuid(),
  role: memberRoleInputSchema,
})
export type AddBoardMemberRequest = z.infer<typeof addBoardMemberRequestSchema>

export const updateBoardRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isPublic: z.boolean().optional(),
    defaultJoinRole: defaultJoinRoleSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one board field is required.",
  })
export type UpdateBoardRequest = z.infer<typeof updateBoardRequestSchema>

// --- Response types ---

export type BoardSummary = {
  id: string
  name: string
  description?: string | null
  currentRevision: number
  isPublic: boolean
  defaultJoinRole: DefaultJoinRole
  createdBy: UserSummary
  createdAt: Date
  updatedAt: Date
}

export type BoardMemberSummary = {
  role: BoardRole
  joinedAt?: Date
  user: UserSummary
}

export type GetBoardMembersResponse = BoardMemberSummary[]
export type UpdateBoardResponse = BoardSummary
export type CreateBoardResponse = BoardSummary
export type ListBoardsResponse = PaginatedResponse<BoardSummary>
export type GetBoardResponse = BoardSummary & {
  memberBoardStatus: BoardMemberSummary
}
