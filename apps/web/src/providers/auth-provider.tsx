"use client"

import { useInitAuth } from "@/features/auth/hooks/useInitAuth"
import { useAuthStore } from "@/stores/auth.store"
import { Loader2 } from "lucide-react"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize silent authentication bootstrapper
  useInitAuth()

  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background select-none">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="animate-pulse text-sm font-medium">
            Connecting to secure gateway...
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
