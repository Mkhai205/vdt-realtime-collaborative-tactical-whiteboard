/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth.store"
import { boardApi } from "@/features/board/api/board.api"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import axios from "axios"

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const { accessToken, isLoading: authLoading } = useAuthStore()
  const [apiErrorMsg, setApiErrorMsg] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const errorMsg = !token ? "Missing invitation token." : apiErrorMsg

  useEffect(() => {
    if (authLoading || !token) return

    if (!accessToken) {
      // Redirect to login page and preserve the redirect path
      router.replace(`/login?redirect=/join?token=${token}`)
      return
    }

    // Attempt to join board
    const performJoin = async () => {
      setJoining(true)
      try {
        const response = await boardApi.joinBoardByLink({ token })
        toast.success("Joined board successfully!")
        router.replace(`/board/${response.boardId}`)
      } catch (err: any) {
        let msg = "Failed to join board. The link might be expired or invalid."
        if (axios.isAxiosError(err)) {
          msg = err.response?.data?.message || msg
        }
        setApiErrorMsg(msg)
      } finally {
        setJoining(false)
      }
    }

    performJoin()
  }, [token, accessToken, authLoading, router])

  if (authLoading || joining) {
    return (
      <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50 select-none dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Joining board workspace...
        </p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-50 p-4 select-none dark:bg-slate-950">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/30">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Unable to Join Workspace
          </h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {errorMsg}
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="mt-2 bg-violet-600 font-semibold text-white hover:bg-violet-500"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return null
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  )
}
