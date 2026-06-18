import type { RawEnv } from "../env.validation"
import { normalizeRequiredString } from "../env.utils"

export function validateDatabaseConfig(config: RawEnv) {
  const databaseUrl = normalizeRequiredString(config.DATABASE_URL)

  if (!databaseUrl) {
    throw new Error("Environment variable DATABASE_URL is required")
  }

  return {
    DATABASE_URL: databaseUrl,
  }
}
