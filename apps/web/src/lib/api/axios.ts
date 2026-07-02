import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth.store"

// ─── Axios Instance ────────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // Required for HttpOnly refresh token cookie
})

// ─── Refresh Token Logic ───────────────────────────────────────────────────────

/** Whether a token refresh is currently in progress */
let isRefreshing = false

/** Queue of requests that arrived while a refresh was in progress */
let refreshQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

/**
 * Flush the queue: either resolve all waiting requests with the new token,
 * or reject them all if the refresh failed.
 */
function flushRefreshQueue(error: unknown, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token!)
    }
  })
  refreshQueue = []
}

// ─── Request Interceptor ───────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState()

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ─── Response Interceptor (401 → Refresh → Retry) ─────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // Only handle 401 once per request, and skip if it's the refresh endpoint itself
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isRefreshing) {
      // Queue this request until the refresh resolves
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          },
          reject,
        })
      })
    }

    isRefreshing = true

    try {
      const { data } = await axios.post<{ accessToken: string; user: unknown }>(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )

      const newToken = data.accessToken

      // Update store with new token
      useAuthStore.getState().setAccessToken(newToken)

      // Update socket auth token if socket is active
      try {
        const { updateSocketToken } = await import("@/lib/socket/socket")
        updateSocketToken(newToken)
      } catch {
        // Socket module may not be loaded — ignore
      }

      flushRefreshQueue(null, newToken)

      // Retry the original request with the new token
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      flushRefreshQueue(refreshError, null)

      // Refresh failed → log out and redirect
      useAuthStore.getState().clearAuth()

      toast.error("Session expired. Please log in again.")

      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }

      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
