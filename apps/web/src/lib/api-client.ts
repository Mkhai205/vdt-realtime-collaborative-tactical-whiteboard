import axios, { AxiosHeaders } from "axios"
import { getAuthRestHeaders } from "@/features/identity/auth-token"
import { getGuestRestHeaders } from "@/features/identity/guest-identity"
import { apiBaseUrl } from "./api-url"

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
})

apiClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)
  const authHeaders = getAuthRestHeaders()
  const identityHeaders =
    "Authorization" in authHeaders ? authHeaders : getGuestRestHeaders()

  for (const [name, value] of Object.entries(identityHeaders)) {
    headers.set(name, value)
  }

  config.headers = headers
  return config
})
