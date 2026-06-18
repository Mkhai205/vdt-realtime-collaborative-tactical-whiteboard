import axios, { AxiosHeaders } from "axios"
import { apiBaseUrl } from "./api-url"
import { useAuthStore } from "@/stores/auth-store"

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)
  const token = useAuthStore.getState().accessToken

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  config.headers = headers
  return config
})
