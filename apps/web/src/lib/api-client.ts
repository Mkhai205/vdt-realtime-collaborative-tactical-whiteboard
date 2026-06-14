import axios, { AxiosHeaders } from "axios"
import { getAuthRestHeaders } from "@/components/features/identity"
import { getGuestRestHeaders } from "@/components/features/identity"
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
