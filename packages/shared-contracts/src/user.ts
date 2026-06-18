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
  lastSeenAt: z.coerce.date().nullable().optional(),
})

export const updateProfileRequestSchema = z
  .object({
    name: nameSchema.optional(),
    avatarColor: colorSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required.",
  })

export type IdentityType = z.infer<typeof identityTypeSchema>
export type UserSummary = z.infer<typeof userSummarySchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>
