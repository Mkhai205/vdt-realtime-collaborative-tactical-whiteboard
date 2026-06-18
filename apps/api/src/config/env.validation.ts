import {
  validateAppConfig,
  validateAuthConfig,
  validateDatabaseConfig,
  validateMailConfig,
} from "./topics"

export type RawEnv = Record<string, unknown>

export function validateEnv(config: RawEnv) {
  return {
    ...config,
    ...validateAppConfig(config),
    ...validateAuthConfig(config),
    ...validateDatabaseConfig(config),
    ...validateMailConfig(config),
  }
}
