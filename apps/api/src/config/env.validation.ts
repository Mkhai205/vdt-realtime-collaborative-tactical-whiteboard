import {
  validateAppConfig,
  validateAuthConfig,
  validateDatabaseConfig,
  validateMailConfig,
  validateRedisConfig,
} from "./topics"

export type RawEnv = Record<string, unknown>

export function validateEnv(config: RawEnv) {
  return {
    ...config,
    ...validateAppConfig(config),
    ...validateAuthConfig(config),
    ...validateDatabaseConfig(config),
    ...validateMailConfig(config),
    ...validateRedisConfig(config),
  }
}
