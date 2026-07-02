import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth.store"
import { authApi } from "../api/auth.api"
import { toast } from "sonner"

export function useAuth() {
  const router = useRouter()
  const { user, accessToken, setAuth, clearAuth } = useAuthStore()

  const loginWithGoogle = async (idToken: string) => {
    try {
      const data = await authApi.loginWithGoogle(idToken)
      setAuth(data.user, data.accessToken)
      toast.success("Logged in successfully!")
      router.push("/dashboard")
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || "Failed to log in with Google"
      toast.error(errMsg)
      throw error
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error("Logout request failed:", error)
    } finally {
      clearAuth()
      toast.success("Logged out successfully!")
      router.push("/login")
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    loginWithGoogle,
    logout,
  }
}
