import { apiClient } from "@/lib/api/axios"
import type {
  LoginResponse,
  RefreshResponse,
} from "@rctw/shared-contracts"

export const authApi = {
  loginWithGoogle: async (idToken: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>("/auth/google", {
      idToken,
    })
    return data
  },

  refreshToken: async (): Promise<RefreshResponse> => {
    const { data } = await apiClient.post<RefreshResponse>("/auth/refresh", {})
    return data
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout", {})
  },
}
