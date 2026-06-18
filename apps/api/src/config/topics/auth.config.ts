import type { RawEnv } from "../env.validation"
import { normalizeRequiredString, parseNumber } from "../env.utils"

export const JWT_CONFIG_KEY = {
  JWT_ACCESS_EXPIRES_IN_SECONDS: 900,
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: 2592000,
  VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS: 86400,
} as const

export const FRONTEND_REDIRECT_URI_CONFIG_KEY = {
  FRONTEND_LOGIN_SUCCESS_REDIRECT:
    "http://localhost:3000/auth/callback/success",
  FRONTEND_LOGIN_FAILURE_REDIRECT: "http://localhost:3000/auth/callback/error",
} as const

export function validateAuthConfig(config: RawEnv) {
  const jwtAccessSecret = normalizeRequiredString(config.JWT_ACCESS_SECRET)
  const googleClientId = normalizeRequiredString(config.GOOGLE_CLIENT_ID)
  const googleClientSecret = normalizeRequiredString(
    config.GOOGLE_CLIENT_SECRET,
  )
  const googleCallbackUrl = normalizeRequiredString(config.GOOGLE_CALLBACK_URL)

  if (!jwtAccessSecret) {
    throw new Error("Environment variable JWT_ACCESS_SECRET is required")
  }
  if (!googleClientId) {
    throw new Error("Environment variable GOOGLE_CLIENT_ID is required")
  }
  if (!googleClientSecret) {
    throw new Error("Environment variable GOOGLE_CLIENT_SECRET is required")
  }
  if (!googleCallbackUrl) {
    throw new Error("Environment variable GOOGLE_CALLBACK_URL is required")
  }

  return {
    // JWT
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_ACCESS_EXPIRES_IN_SECONDS: parseNumber(
      config.JWT_ACCESS_EXPIRES_IN_SECONDS,
      JWT_CONFIG_KEY.JWT_ACCESS_EXPIRES_IN_SECONDS,
      "JWT_ACCESS_EXPIRES_IN_SECONDS",
    ),
    REFRESH_TOKEN_EXPIRES_IN_SECONDS: parseNumber(
      config.REFRESH_TOKEN_EXPIRES_IN_SECONDS,
      JWT_CONFIG_KEY.REFRESH_TOKEN_EXPIRES_IN_SECONDS,
      "REFRESH_TOKEN_EXPIRES_IN_SECONDS",
    ),
    VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS: parseNumber(
      config.VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS,
      JWT_CONFIG_KEY.VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS,
      "VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS",
    ),
    // Google OAuth
    GOOGLE_CLIENT_ID: googleClientId,
    GOOGLE_CLIENT_SECRET: googleClientSecret,
    GOOGLE_CALLBACK_URL: googleCallbackUrl,
    FRONTEND_LOGIN_SUCCESS_REDIRECT: String(
      config.FRONTEND_LOGIN_SUCCESS_REDIRECT ??
        FRONTEND_REDIRECT_URI_CONFIG_KEY.FRONTEND_LOGIN_SUCCESS_REDIRECT,
    ).trim(),
    FRONTEND_LOGIN_FAILURE_REDIRECT: String(
      config.FRONTEND_LOGIN_FAILURE_REDIRECT ??
        FRONTEND_REDIRECT_URI_CONFIG_KEY.FRONTEND_LOGIN_FAILURE_REDIRECT,
    ).trim(),
  }
}
