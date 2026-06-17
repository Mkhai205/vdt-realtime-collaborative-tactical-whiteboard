import { z } from "zod"

export const identityTypeSchema = z.enum(["GUEST", "GOOGLE"])
export const identityTypes = identityTypeSchema.enum

export const nameSchema = z.string().trim().min(1).max(50)
export const colorSchema = z.string().trim().min(1).max(20)
export const emailSchema = z.email().trim().max(255)

export const userSummarySchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  email: emailSchema.nullable().optional(),
  avatarUrl: z.url().nullable().optional(),
  avatarColor: colorSchema.nullable().optional(),
  identityType: identityTypeSchema,
})

export type IdentityType = z.infer<typeof identityTypeSchema>
export type UserSummary = z.infer<typeof userSummarySchema>
