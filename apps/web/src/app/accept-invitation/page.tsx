/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, Suspense, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth.store"
import { invitationApi } from "@/features/board/api/invitation.api"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const { accessToken, isLoading: authLoading } = useAuthStore()
  const acceptCalled = useRef(false)

  useEffect(() => {
    if (authLoading) return

    if (!token) {
      toast.error("Missing invitation token.")
      router.replace("/dashboard")
      return
    }

    if (!accessToken) {
      // Redirect to login page and preserve the redirect path
      router.replace(`/login?redirect=/accept-invitation?token=${token}`)
      return
    }

    if (acceptCalled.current) return
    acceptCalled.current = true

    const performAccept = async () => {
      try {
        const response = await invitationApi.acceptInvitation({ token })
        toast.success("Workspace invitation accepted!")
        router.replace(`/board/${response.boardId}`)
      } catch (err: any) {
        let msg =
          "Failed to accept invitation. The invitation link might be expired or invalid."
        if (axios.isAxiosError(err)) {
          msg = err.response?.data?.message || msg
        }
        toast.error(msg)
        router.replace("/dashboard")
      }
    }

    performAccept()
  }, [token, accessToken, authLoading, router])

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50 select-none dark:bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Accepting email invitation...
      </p>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  )
}
