import { z } from "zod"

export const identityTypeSchema = z.enum(["GUEST", "GOOGLE"])
export const identityTypes = identityTypeSchema.enum
export const boardRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"])
export const boardRoles = boardRoleSchema.enum

export const guestIdentityStorageKey = "rctw.guestIdentity.v1"
export const authTokenStorageKey = "rctw.authToken.v1"
export const authorizationHeaderName = "Authorization"

export const guestNameSchema = z.string().trim().min(1).max(120)
export const guestAvatarColorSchema = z.string().trim().min(1).max(20)

export const guestIdentitySchema = z.object({
  id: z.uuid(),
  name: guestNameSchema,
  avatarColor: guestAvatarColorSchema,
})

export const bearerTokenSchema = z.string().trim().min(1)

export const authRestHeadersSchema = z.object({
  [authorizationHeaderName]: z.string().startsWith("Bearer "),
})

export const jwtIdentityPayloadSchema = z.object({
  sub: z.uuid(),
  email: z.email().nullable().optional(),
  name: guestNameSchema,
  identityType: identityTypeSchema,
  avatarUrl: z.url().nullable().optional(),
  avatarColor: guestAvatarColorSchema.nullable().optional(),
})

export const socketAuthPayloadSchema = z.object({
  token: bearerTokenSchema.optional(),
})

export function buildBearerAuthHeader(token: string): AuthRestHeaders {
  return {
    [authorizationHeaderName]: `Bearer ${bearerTokenSchema.parse(token)}`,
  }
}

export function buildJwtSocketAuth(token: string): SocketAuthPayload {
  return {
    token: bearerTokenSchema.parse(token),
  }
}

export type IdentityType = z.infer<typeof identityTypeSchema>
export type BoardRole = z.infer<typeof boardRoleSchema>
export type GuestIdentity = z.infer<typeof guestIdentitySchema>

export type AuthRestHeaders = z.infer<typeof authRestHeadersSchema>
export type JwtIdentityPayload = z.infer<typeof jwtIdentityPayloadSchema>
export type SocketAuthPayload = z.infer<typeof socketAuthPayloadSchema>

export const editableBoardRoles = ["OWNER", "EDITOR"] as const
export const manageableBoardRoles = ["OWNER"] as const

export type EditableBoardRole = (typeof editableBoardRoles)[number]
export type ManageableBoardRole = (typeof manageableBoardRoles)[number]

export function canEditBoardRole(role: BoardRole): role is EditableBoardRole {
  return editableBoardRoles.includes(role as EditableBoardRole)
}

export function canManageBoardRole(
  role: BoardRole,
): role is ManageableBoardRole {
  return manageableBoardRoles.includes(role as ManageableBoardRole)
}
