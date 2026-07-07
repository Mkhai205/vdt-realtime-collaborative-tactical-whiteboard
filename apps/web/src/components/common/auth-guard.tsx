"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, useIsAuthenticated } from "@/stores/auth.store"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useIsAuthenticated()
  const isLoading = useAuthStore((state) => state.isLoading)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="animate-pulse text-sm font-medium">
            Verifying your session...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}
