import { parseBoolean, parseNumber } from "../env.utils"
import { RawEnv } from "../env.validation"

export const MAIL_CONFIG_KEY = {
  MAIL_SMTP_HOST: "smtp.gmail.com",
  MAIL_SMTP_PORT: 587,
  MAIL_SMTP_SECURE: false,
} as const

export function validateMailConfig(config: RawEnv) {
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
    MAIL_SMTP_FROM: String(config.MAIL_SMTP_FROM).trim(),
    MAIL_SMTP_USER: String(config.MAIL_SMTP_USER).trim(),
    MAIL_SMTP_PASSWORD: String(config.MAIL_SMTP_PASSWORD).trim(),
  }
}
