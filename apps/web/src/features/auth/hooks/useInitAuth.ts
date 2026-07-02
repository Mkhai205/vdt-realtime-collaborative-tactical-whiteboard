import { useEffect } from "react"
import { useAuthStore } from "@/stores/auth.store"
import { authApi } from "../api/auth.api"

export function useInitAuth() {
  useEffect(() => {
    let active = true
    
    const init = async () => {
      const state = useAuthStore.getState()
      
      // If there is no persisted user, we don't have an active session to bootstrap
      if (!state.user) {
        state.setIsLoading(false)
        return
      }

      try {
        const data = await authApi.refreshToken()
        if (active) {
          state.setAuth(data.user, data.accessToken)
        }
      } catch (error) {
        console.error("Failed to bootstrap silent refresh on mount:", error)
        if (active) {
          state.clearAuth()
        }
      } finally {
        if (active) {
          state.setIsLoading(false)
        }
      }
    }

    init()
    
    return () => {
      active = false
    }
  }, [])
}
