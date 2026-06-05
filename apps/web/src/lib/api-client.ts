import axios, { AxiosHeaders } from "axios"
import { getGuestRestHeaders } from "@/features/identity/guest-identity"

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1"

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
})

apiClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)

  for (const [name, value] of Object.entries(getGuestRestHeaders())) {
    headers.set(name, value)
  }

  config.headers = headers
  return config
})
