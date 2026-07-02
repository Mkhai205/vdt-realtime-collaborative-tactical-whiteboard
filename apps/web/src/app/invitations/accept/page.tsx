"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

function InvitationsAcceptContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    if (token) {
      router.replace(`/accept-invitation?token=${token}`)
    } else {
      router.replace("/dashboard")
    }
  }, [token, router])

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  )
}

export default function InvitationsAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <InvitationsAcceptContent />
    </Suspense>
  )
}
