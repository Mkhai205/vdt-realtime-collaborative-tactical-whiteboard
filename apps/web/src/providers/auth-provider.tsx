"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/stores/auth-store"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  return <>{children}</>
}
