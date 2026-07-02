import { parseStringArray } from "../env.utils"
import type { RawEnv } from "../env.validation"

export const APP_CONFIG_KEY = {
  NODE_ENV: "development",
  PORT: 3001,
  CORS_ORIGIN: "http://localhost:3000",
  FRONTEND_URL: "http://localhost:3000",
} as const

export function validateAppConfig(config: RawEnv) {
  return {
    NODE_ENV: config.NODE_ENV ?? APP_CONFIG_KEY.NODE_ENV,
    PORT: Number(config.PORT ?? APP_CONFIG_KEY.PORT),
    CORS_ORIGIN: parseStringArray(
      config.CORS_ORIGIN,
      [APP_CONFIG_KEY.CORS_ORIGIN],
      "CORS_ORIGIN",
    ),
    FRONTEND_URL: config.FRONTEND_URL ?? APP_CONFIG_KEY.FRONTEND_URL,
  }
}
