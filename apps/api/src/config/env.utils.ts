export function parseNumber(
  value: unknown,
  fallback: number,
  key: string,
): number {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`)
  }

  return parsed
}

export function parseBoolean(
  value: unknown,
  fallback: boolean,
  key: string,
): boolean {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  if (typeof value === "boolean") {
    return value
  }

  const normalized = String(value).trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  throw new Error(`Environment variable ${key} must be a valid boolean`)
}

export function parseStringArray(
  value: unknown,
  fallback: string[],
  key: string,
): string[] {
  if (value === undefined || value === null || value === "") {
    return fallback
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim())
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0)
  }
  throw new Error(
    `Environment variable ${key} must be a string or an array of strings`,
  )
}

export function normalizeRequiredString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  const str = String(value).trim()
  return str.length > 0 ? str : undefined
}
