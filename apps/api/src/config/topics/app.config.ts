import { parseStringArray } from "../env.utils"
import type { RawEnv } from "../env.validation"

export const APP_CONFIG_KEY = {
  PORT: 3001,
  CORS_ORIGIN: "http://localhost:3000",
} as const

export function validateAppConfig(config: RawEnv) {
  const corsOrigins = parseStringArray(
    config.CORS_ORIGIN,
    [APP_CONFIG_KEY.CORS_ORIGIN],
    "CORS_ORIGIN",
  )

  return {
    PORT: Number(config.PORT ?? APP_CONFIG_KEY.PORT),
    CORS_ORIGIN: corsOrigins,
  }
}
