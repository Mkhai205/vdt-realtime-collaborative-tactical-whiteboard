export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1"

export const socketBaseUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? toSocketBaseUrl(apiBaseUrl)

function toSocketBaseUrl(url: string): string {
  if (url.startsWith("/")) {
    return ""
  }

  try {
    return new URL(url).origin
  } catch {
    return "http://localhost:3001"
  }
}
