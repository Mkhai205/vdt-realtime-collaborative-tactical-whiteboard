"use client"

import { FormEvent, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { generateGuestAvatarColor } from "./guest-identity"
import { useAuthStore } from "@/stores/auth-store"
import { GoogleLogin } from "@react-oauth/google"

const previewSeed = "rctw-preview"

export function GuestIdentityForm() {
  const user = useAuthStore((state) => state.user)
  const registerGuestAction = useAuthStore((state) => state.registerGuest)
  const updateProfileAction = useAuthStore((state) => state.updateProfile)
  const logoutAction = useAuthStore((state) => state.logout)
  const loginWithGoogleAction = useAuthStore((state) => state.loginWithGoogle)

  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null)
  const [error, setError] = useState("")

  const displayName = draftDisplayName ?? user?.name ?? ""

  const avatarColor = useMemo(
    () => user?.avatarColor ?? generateGuestAvatarColor(previewSeed),
    [user?.avatarColor],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = displayName.trim()
    if (!nextName) {
      setError("Enter a display name before joining.")
      return
    }
    try {
      if (user?.id) {
        await updateProfileAction({ name: nextName })
      } else {
        await registerGuestAction(nextName)
      }
      setDraftDisplayName(nextName)
      setError("")
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(
        apiError?.response?.data?.message || "Failed to save guest identity.",
      )
    }
  }

  function handleClear() {
    void logoutAction()
    setDraftDisplayName("")
    setError("")
  }

  function handleLogout() {
    void logoutAction()
  }

  const isAuthenticated = user?.identityType === "GOOGLE"
  const hasIdentity = user?.identityType === "GUEST"

  return (
    <div className="flex flex-col gap-5">
      {/* Google OAuth section */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Authentication
        </p>
        {isAuthenticated ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div
                className="size-2 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  Google session active
                </span>
                <span className="text-xs text-muted-foreground">
                  JWT takes priority over guest headers
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
        ) : (
          <div className="flex w-full justify-center [&_iframe]:!w-full [&_iframe]:!max-w-none">
            <GoogleLogin
              onSuccess={(response) => {
                if (response.credential) {
                  loginWithGoogleAction(response.credential).catch((err) => {
                    setError(
                      err?.response?.data?.message || "Google login failed",
                    )
                  })
                }
              }}
              onError={() => {
                setError("Google login failed")
              }}
              theme="outline"
              size="large"
              width="315" // slightly matches parent container width
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          or use guest identity
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Guest identity form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="guest-display-name">Display name</FieldLabel>
          <div className="flex gap-2">
            {/* Avatar preview */}
            <div
              className="size-10 shrink-0 rounded-lg border-2 border-border"
              style={{ backgroundColor: avatarColor }}
              title="Your avatar color (auto-generated)"
              aria-label={`Avatar color: ${avatarColor}`}
            />
            <Input
              id="guest-display-name"
              name="guest-display-name"
              value={displayName}
              onChange={(event) => {
                setDraftDisplayName(event.target.value)
                setError("")
              }}
              placeholder="e.g. Alpha Lead"
              maxLength={120}
              aria-invalid={Boolean(error)}
              className="h-10 flex-1"
            />
          </div>
          {error ? (
            <FieldDescription className="text-destructive">
              {error}
            </FieldDescription>
          ) : null}
        </Field>

        <div className="flex gap-2">
          <Button type="submit" className="h-9 flex-1">
            {hasIdentity ? "Update identity" : "Create guest"}
          </Button>
          {hasIdentity && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-muted-foreground hover:border-destructive/30 hover:text-destructive"
              onClick={handleClear}
              title="Clear guest session"
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Status info — compact */}
      {hasIdentity && (
        <div className="rounded-lg border bg-secondary/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{user?.name}</span>
          {" · "}
          <span className="font-mono text-[11px]">
            {user?.id?.slice(0, 8)}…
          </span>
          {isAuthenticated ? " · JWT active" : " · Guest headers"}
        </div>
      )}
    </div>
  )
}
