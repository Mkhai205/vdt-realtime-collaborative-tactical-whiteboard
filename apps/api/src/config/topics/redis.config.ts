import type { RawEnv } from "../env.validation"
import { normalizeRequiredString } from "../env.utils"

export function validateRedisConfig(config: RawEnv) {
  const redisUrl =
    normalizeRequiredString(config.REDIS_URL) || "redis://localhost:6379"

  return {
    REDIS_URL: redisUrl,
  }
}
