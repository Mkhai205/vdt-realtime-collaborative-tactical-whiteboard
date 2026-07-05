import type { RawEnv } from "../env.validation"
import {
  normalizeRequiredString,
  parseNumber,
  parseBoolean,
} from "../env.utils"

export function validateMinioConfig(config: RawEnv) {
  const endpoint = normalizeRequiredString(config.MINIO_ENDPOINT) || "localhost"
  const port = parseNumber(config.MINIO_PORT, 9000, "MINIO_PORT")
  const useSsl = parseBoolean(config.MINIO_USE_SSL, false, "MINIO_USE_SSL")
  const accessKey = normalizeRequiredString(config.MINIO_ACCESS_KEY) || "admin"
  const secretKey =
    normalizeRequiredString(config.MINIO_SECRET_KEY) || "admin123456"
  const bucket = normalizeRequiredString(config.MINIO_BUCKET) || "whiteboard"

  return {
    MINIO_ENDPOINT: endpoint,
    MINIO_PORT: port,
    MINIO_USE_SSL: useSsl,
    MINIO_ACCESS_KEY: accessKey,
    MINIO_SECRET_KEY: secretKey,
    MINIO_BUCKET: bucket,
  }
}
