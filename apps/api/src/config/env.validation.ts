import {
  validateAppConfig,
  validateAuthConfig,
  validateDatabaseConfig,
} from "./topics"

export type RawEnv = Record<string, unknown>

export function validateEnv(config: RawEnv): RawEnv {
  return {
    ...config,
    ...validateAppConfig(config),
    ...validateAuthConfig(config),
    ...validateDatabaseConfig(config),
  }
}
