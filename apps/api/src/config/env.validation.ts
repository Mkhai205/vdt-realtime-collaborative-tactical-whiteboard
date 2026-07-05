import {
  validateAppConfig,
  validateAuthConfig,
  validateDatabaseConfig,
  validateMailConfig,
  validateRedisConfig,
  validateMinioConfig,
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
    ...validateMinioConfig(config),
  }
}
