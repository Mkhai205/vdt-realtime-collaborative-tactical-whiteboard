import {
  normalizeRequiredString,
  parseBoolean,
  parseNumber,
} from "../env.utils"
import { RawEnv } from "../env.validation"

export const MAIL_CONFIG_KEY = {
  MAIL_SMTP_HOST: "smtp.gmail.com",
  MAIL_SMTP_PORT: 587,
  MAIL_SMTP_SECURE: false,
  MAIL_SMTP_CONNECTION_TIMEOUT: 10000,
  MAIL_FROM_NAME: "Real Time Collaborative Tactical Whiteboard Team",
} as const

export function validateMailConfig(config: RawEnv) {
  const smtpUser = normalizeRequiredString(config.SMTP_USER)
  const smtpPassword = normalizeRequiredString(config.SMTP_PASSWORD)

  return {
    MAIL_SMTP_HOST: String(
      config.MAIL_SMTP_HOST ?? MAIL_CONFIG_KEY.MAIL_SMTP_HOST,
    ).trim(),
    MAIL_SMTP_PORT: parseNumber(
      config.MAIL_SMTP_PORT,
      MAIL_CONFIG_KEY.MAIL_SMTP_PORT,
      "MAIL_SMTP_PORT",
    ),
    MAIL_SMTP_SECURE: parseBoolean(
      config.MAIL_SMTP_SECURE,
      MAIL_CONFIG_KEY.MAIL_SMTP_SECURE,
      "MAIL_SMTP_SECURE",
    ),
    MAIL_SMTP_CONNECTION_TIMEOUT: parseNumber(
      config.MAIL_SMTP_CONNECTION_TIMEOUT,
      MAIL_CONFIG_KEY.MAIL_SMTP_CONNECTION_TIMEOUT,
      "MAIL_SMTP_CONNECTION_TIMEOUT",
    ),
    SMTP_USER: smtpUser,
    SMTP_PASSWORD: smtpPassword,
  }
}
