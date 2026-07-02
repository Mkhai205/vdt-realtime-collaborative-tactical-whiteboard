"use client"

import { GoogleOAuthProvider } from "@react-oauth/google"
import { LoginForm } from "@/features/auth/components/login-form"
import { Suspense } from "react"

export default function LoginPage() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="w-full max-w-sm md:max-w-3xl">
        <Suspense fallback={<div className="h-10" />}>
          <LoginForm />
        </Suspense>
      </div>
    </GoogleOAuthProvider>
  )
}
