import type { RawEnv } from "../env.validation"
import { normalizeRequiredString } from "../env.utils"

export function validateAuthConfig(config: RawEnv) {
  const jwtAccessSecret = normalizeRequiredString(config.JWT_ACCESS_SECRET)
  const googleClientId = normalizeRequiredString(config.GOOGLE_CLIENT_ID)

  if (!jwtAccessSecret) {
    throw new Error("Environment variable JWT_ACCESS_SECRET is required")
  }
  if (!googleClientId) {
    throw new Error("Environment variable GOOGLE_CLIENT_ID is required")
  }

  return {
    // JWT
    JWT_ACCESS_SECRET: jwtAccessSecret,
    // Google OAuth
    GOOGLE_CLIENT_ID: googleClientId,
  }
}
