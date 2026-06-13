import type { RawEnv } from "../env.validation"
import { normalizeRequiredString, parseNumber } from "../env.utils"

export const JWT_CONFIG_KEY = {
  JWT_ACCESS_EXPIRES_IN_SECONDS: 900,
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: 2592000,
  RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS: 900,
  VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS: 86400,
} as const

export const FRONTEND_REDIRECT_URI_CONFIG_KEY = {
  FRONTEND_LOGIN_SUCCESS_REDIRECT:
    "http://localhost:3000/auth/callback/success",
  FRONTEND_LOGIN_FAILURE_REDIRECT: "http://localhost:3000/auth/callback/error",
} as const

export function validateAuthConfig(config: RawEnv): RawEnv {
  const jwtAccessSecret = normalizeRequiredString(config.JWT_ACCESS_SECRET)
  const googleClientId = normalizeRequiredString(config.GOOGLE_CLIENT_ID)
  const googleClientSecret = normalizeRequiredString(
    config.GOOGLE_CLIENT_SECRET,
  )
  const googleCallbackUrl = normalizeRequiredString(config.GOOGLE_CALLBACK_URL)

  return {
    // JWT
    JWT_ACCESS_SECRET: jwtAccessSecret || undefined,
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
    RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS: parseNumber(
      config.RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
      JWT_CONFIG_KEY.RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
      "RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS",
    ),
    VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS: parseNumber(
      config.VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS,
      JWT_CONFIG_KEY.VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS,
      "VERIFY_EMAIL_TOKEN_EXPIRES_IN_SECONDS",
    ),
    // Google OAuth
    GOOGLE_CLIENT_ID: googleClientId || undefined,
    GOOGLE_CLIENT_SECRET: googleClientSecret || undefined,
    GOOGLE_CALLBACK_URL: googleCallbackUrl || undefined,
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
