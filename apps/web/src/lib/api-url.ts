export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1"

export const googleOAuthStartUrl = `${apiBaseUrl}/auth/google`
