import { create } from "zustand"
import {
  type UserSummary,
  type UpdateProfileRequest,
} from "@rctw/shared-contracts"
import { apiClient } from "@/lib/api-client"
import { updateProfile as apiUpdateProfile } from "@/lib/user-api"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export interface AuthState {
  accessToken: string | null
  user: UserSummary | null
  isLoading: boolean
  isInitialized: boolean
  setAccessToken: (token: string) => void
  clearAuth: () => void
  initializeAuth: () => Promise<void>
  updateProfile: (request: UpdateProfileRequest) => Promise<void>
  logout: () => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isLoading: true,
  isInitialized: false,

  setAccessToken: (token: string) => {
    const decoded = decodeJwt(token)
    if (decoded) {
      set({
        accessToken: token,
        user: {
          id: decoded.id || decoded.sub,
          name: decoded.name,
          email: decoded.email,
          avatarUrl: decoded.avatarUrl,
          avatarColor: decoded.avatarColor,
        },
      })
    } else {
      set({ accessToken: null, user: null })
    }
  },

  clearAuth: () => {
    set({ accessToken: null, user: null })
  },

  initializeAuth: async () => {
    set({ isLoading: true })
    try {
      const response = await apiClient.post<{
        accessToken: string
        user: UserSummary
      }>("/auth/refresh")
      const { accessToken } = response.data
      const decoded = decodeJwt(accessToken)
      if (decoded) {
        set({
          accessToken,
          user: {
            id: decoded.id || decoded.sub,
            name: decoded.name,
            email: decoded.email,
            avatarUrl: decoded.avatarUrl,
            avatarColor: decoded.avatarColor,
          },
        })
      } else {
        set({ accessToken: null, user: null })
      }
    } catch {
      set({ accessToken: null, user: null })
    } finally {
      set({ isLoading: false, isInitialized: true })
    }
  },

  updateProfile: async (request: UpdateProfileRequest) => {
    set({ isLoading: true })
    try {
      const response = await apiUpdateProfile(request)
      set({ user: response.user })
      // Sync access token from update profile response
      const { setAccessToken } = useAuthStore.getState()
      setAccessToken(response.accessToken)
    } catch (err) {
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await apiClient.post("/auth/logout")
    } catch {
      // Proceed with local logout even if api call fails
    } finally {
      set({ accessToken: null, user: null, isLoading: false })
    }
  },

  loginWithGoogle: async (idToken: string) => {
    set({ isLoading: true })
    try {
      const response = await apiClient.post<{
        accessToken: string
        user: UserSummary
      }>("/auth/google", {
        idToken,
      })
      const { accessToken } = response.data
      const decoded = decodeJwt(accessToken)
      if (decoded) {
        set({
          accessToken,
          user: {
            id: decoded.id || decoded.sub,
            name: decoded.name,
            email: decoded.email,
            avatarUrl: decoded.avatarUrl,
            avatarColor: decoded.avatarColor,
          },
        })
      }
    } catch (err) {
      set({ accessToken: null, user: null })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },
}))
