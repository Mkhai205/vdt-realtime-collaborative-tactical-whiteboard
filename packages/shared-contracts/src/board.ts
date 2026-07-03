import { z } from "zod"
import { PaginatedResponse, PaginationQuerySchema } from "./common"
import { emailSchema, nameSchema, UserSummary } from "./user"

// --- Enums ---

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

export const objectTypeSchema = z.enum([
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "TEXT",
  "PATH",
  "ICON",
])
export type ObjectType = z.infer<typeof objectTypeSchema>
export const objectTypes = objectTypeSchema.enum

export const toolSchema = z.enum([
  "SELECT",
  "HAND",
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "TEXT",
  "PATH",
  "ICON",
])
export type Tool = z.infer<typeof toolSchema>
export const tools = toolSchema.enum

export const operationTypeSchema = z.enum([
  "OBJECT_CREATE",
  "OBJECT_UPDATE",
  "OBJECT_DELETE",
  "OBJECT_RESTORE",
])
export type OperationType = z.infer<typeof operationTypeSchema>
export const operationTypes = operationTypeSchema.enum

// --- Board schemas ---

export const listBoardsQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
})
export type ListBoardsQuery = z.infer<typeof listBoardsQuerySchema>

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

export const updateBoardSettingsRequestSchema = z.object({
  visibility: boardVisibilitySchema,
})
export type UpdateBoardSettingsRequest = z.infer<
  typeof updateBoardSettingsRequestSchema
>

export type BoardSummary = {
  id: string
  name: string
  description: string | null
  visibility: BoardVisibility
  currentRevision: number
  createdBy: UserSummary
  createdAt: string
  updatedAt: string
}

export type BoardResponse = BoardSummary
export type ListBoardsResponse = PaginatedResponse<BoardSummary>
export type BoardDetailResponse = BoardSummary & {
  effectiveRole: EffectiveBoardRole
}

// --- Board Data schemas ---

export const boardOperationsQuerySchema = PaginationQuerySchema.extend({
  fromRevision: z.coerce.number().int().nonnegative().optional(),
})
export type BoardOperationsQuery = z.infer<typeof boardOperationsQuerySchema>

export const shapeStyleSchema = z
  .object({
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    opacity: z.number().min(0).max(1).optional(),
    fontSize: z.number().positive().optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    color: z.string().optional(),
    arrowStart: z.boolean().optional(),
    arrowEnd: z.boolean().optional(),
    iconKey: z.string().optional(),
    assetUrl: z.string().optional(),
    scale: z.number().positive().optional(),
    label: z.string().optional(),
  })
  .catchall(z.unknown())
export type ShapeStyle = z.infer<typeof shapeStyleSchema>

export type BoardObjectDto = {
  id: string
  boardId: string
  type: ObjectType
  x: number
  y: number
  width?: number | null
  height?: number | null
  points?: unknown | null
  text?: string | null
  rotation: number
  style: ShapeStyle
  zIndex: number
  version: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

export type BoardOperationDto = {
  id: string
  clientOpId: string
  boardId: string
  revision: number
  actorId: string
  objectId?: string | null
  type: OperationType
  baseObjectVersion?: number | null
  payload: unknown
  createdAt: string
}

export type BoardObjectsResponse = {
  revision: number
  objects: BoardObjectDto[]
}
export type BoardOperationsResponse = {
  latestRevision: number
  hasMore: boolean
  operations: BoardOperationDto[]
}

// --- Board Member schemas ---

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

export type BoardMemberSummary = {
  id: string
  role: BoardRole
  joinedAt: string
  user: UserSummary
}

export type BoardMemberResponse = BoardMemberSummary
export type ListBoardMembersResponse = BoardMemberSummary[]

// --- Board Join Request schemas ---

export const respondJoinRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
})
export type RespondJoinRequest = z.infer<typeof respondJoinRequestSchema>

// --- Board Share Link schemas ---

export const createBoardShareLinkRequestSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER"]),
})
export type CreateBoardShareLinkRequest = z.infer<
  typeof createBoardShareLinkRequestSchema
>

export const joinBoardByLinkRequestSchema = z.object({
  token: z.uuid(),
})
export type JoinBoardByLinkRequest = z.infer<
  typeof joinBoardByLinkRequestSchema
>

export type BoardShareLinkResponse = {
  id: string
  token: string
  role: "EDITOR" | "VIEWER"
  url: string
  createdAt: string
}

export type JoinBoardByLinkResponse = {
  boardId: string
  role: string
}

// --- Board Invitation schemas ---

export const createBoardInvitationRequestSchema = z.object({
  email: z.email(),
  role: z.enum(["EDITOR", "VIEWER"]),
})
export type CreateBoardInvitationRequest = z.infer<
  typeof createBoardInvitationRequestSchema
>

export const acceptBoardInvitationRequestSchema = z.object({
  token: z.uuid(),
})
export type AcceptBoardInvitationRequest = z.infer<
  typeof acceptBoardInvitationRequestSchema
>

export type BoardInvitationResponse = {
  id: string
  boardId: string
  email: string
  role: "EDITOR" | "VIEWER"
  token: string
  expiresAt: string
  createdAt: string
  invitedBy: UserSummary
}
