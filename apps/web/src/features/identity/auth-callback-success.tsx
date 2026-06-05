"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { writeStoredAuthToken } from "./auth-token"

export function AuthCallbackSuccess() {
  const router = useRouter()

  useEffect(() => {
    const fragment = window.location.hash.replace(/^#/, "")
    const params = new URLSearchParams(fragment)
    const accessToken = params.get("accessToken")?.trim()

    window.history.replaceState(
      null,
      document.title,
      `${window.location.pathname}${window.location.search}`
    )

    if (!accessToken) {
      router.replace("/auth/callback/error?reason=missing_access_token")
      return
    }

    writeStoredAuthToken(accessToken)
    router.replace("/")
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold">Completing Google login</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Saving your authenticated session.
        </p>
      </section>
    </main>
  )
}
