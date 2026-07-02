"use client"

import { GoogleLogin } from "@react-oauth/google"
import { toast } from "sonner"
import { useAuth } from "../hooks/useAuth"
import { useState } from "react"
import { Loader2 } from "lucide-react"

export function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth()
  const [isPending, setIsPending] = useState(false)

  return (
    <div className="relative flex min-h-10 w-full justify-center select-none">
      {isPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/80">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) {
            toast.error("Google login failed: no credential received")
            return
          }
          setIsPending(true)
          try {
            await loginWithGoogle(credentialResponse.credential)
          } catch (error) {
            console.error("Google login error:", error)
          } finally {
            setIsPending(false)
          }
        }}
        onError={() => {
          toast.error("Google login failed")
        }}
        theme="outline"
        size="large"
        shape="rectangular"
        width="320"
      />
    </div>
  )
}
