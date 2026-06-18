"use client"

import { FormEvent, useMemo, useState } from "react"
import { type UserSummary } from "@rctw/shared-contracts"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { googleOAuthStartUrl } from "@/lib/api-url"
import { generateGuestAvatarColor } from "./guest-identity"
import { useAuthStore } from "@/stores/auth-store"

const previewSeed = "rctw-preview"

export function GuestIdentityForm() {
  const user = useAuthStore((state) => state.user)
  const registerGuestAction = useAuthStore((state) => state.registerGuest)
  const updateProfileAction = useAuthStore((state) => state.updateProfile)
  const logoutAction = useAuthStore((state) => state.logout)

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
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to save guest identity.",
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Authentication
        </p>
        {isAuthenticated ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Google session active</span>
                <span className="text-xs text-muted-foreground">JWT takes priority over guest headers</span>
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
          <Button asChild className="w-full h-10 gap-2.5" variant="outline">
            <a href={googleOAuthStartUrl}>
              {/* Google logo */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </a>
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or use guest identity</span>
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
            <FieldDescription className="text-destructive">{error}</FieldDescription>
          ) : null}
        </Field>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1 h-9">
            {hasIdentity ? "Update identity" : "Create guest"}
          </Button>
          {hasIdentity && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-muted-foreground hover:text-destructive hover:border-destructive/30"
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
        <div className="rounded-lg bg-secondary/60 border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">{user?.name}</span>
          {" · "}
          <span className="font-mono text-[11px]">{user?.id?.slice(0, 8)}…</span>
          {isAuthenticated ? " · JWT active" : " · Guest headers"}
        </div>
      )}
    </div>
  )
}
