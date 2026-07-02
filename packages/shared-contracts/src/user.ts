import { z } from "zod"

export const nameSchema = z.string().trim().min(1).max(50)
export const colorSchema = z.string().trim().min(1).max(20)
export const emailSchema = z.email().trim().max(255)

export const updateProfileRequestSchema = z
  .object({
    name: nameSchema.optional(),
    avatarColor: colorSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required.",
  })
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

export const userSummarySchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  avatarUrl: z.url().nullable().optional(),
  avatarColor: colorSchema.nullable().optional(),
})
export type UserSummary = {
  id: string
  name: string
  avatarUrl?: string | null
  avatarColor?: string | null
}

// --- Response Types ---

export type UserResponse = UserSummary & {
  email: string
}

export type UpdateProfileResponse = {
  user: UserSummary
  accessToken: string
}
