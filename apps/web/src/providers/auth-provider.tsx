"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { GoogleOAuthProvider } from "@react-oauth/google"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {children}
    </GoogleOAuthProvider>
  )
}
