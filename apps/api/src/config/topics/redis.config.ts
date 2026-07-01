import type { RawEnv } from "../env.validation"
import { normalizeRequiredString } from "../env.utils"

export function validateRedisConfig(config: RawEnv) {
  // REDIS_URL không bắt buộc, có thể fallback về localhost
  const redisUrl = normalizeRequiredString(config.REDIS_URL) || "redis://localhost:6379"

  return {
    REDIS_URL: redisUrl,
  }
}
