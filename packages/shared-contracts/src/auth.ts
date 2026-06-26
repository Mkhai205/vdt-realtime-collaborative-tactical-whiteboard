import z from "zod"
import { UserSummary } from "./user"

export type JwtPayload = {
  sub: string
  name: string
  email: string | null
  avatarUrl?: string | null
  avatarColor?: string | null
}

export const loginGoogleSchema = z.object({
  idToken: z.string(),
})
export type LoginGoogleRequest = z.infer<typeof loginGoogleSchema>

// --- Response Types ---
export type LoginResponse = {
  accessToken: string
  user: UserSummary
}

export type RefreshResponse = {
  accessToken: string
  user: UserSummary
}
