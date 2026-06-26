"use client"

import { FormEvent, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/stores/auth-store"
import { GoogleLogin } from "@react-oauth/google"

export function GuestIdentityForm() {
  const user = useAuthStore((state) => state.user)
  const updateProfileAction = useAuthStore((state) => state.updateProfile)
  const logoutAction = useAuthStore((state) => state.logout)
  const loginWithGoogleAction = useAuthStore((state) => state.loginWithGoogle)

  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null)
  const [error, setError] = useState("")

  const displayName = draftDisplayName ?? user?.name ?? ""
  const avatarColor = user?.avatarColor ?? "#9CA3AF"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = displayName.trim()
    if (!nextName) {
      setError("Enter a display name.")
      return
    }
    try {
      await updateProfileAction({ name: nextName })
      setDraftDisplayName(nextName)
      setError("")
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(
        apiError?.response?.data?.message || "Failed to update profile.",
      )
    }
  }

  function handleLogout() {
    void logoutAction()
    setDraftDisplayName(null)
    setError("")
  }

  const isLoggedIn = Boolean(user)

  return (
    <div className="flex flex-col gap-5">
      {/* Google OAuth section */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Authentication
        </p>
        {isLoggedIn ? (
          <div className="flex flex-col gap-4">
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
                    Logged in as {user?.email}
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

            {/* Profile update form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t pt-4">
              <Field>
                <FieldLabel htmlFor="display-name">Display name</FieldLabel>
                <div className="flex gap-2">
                  {/* Avatar preview */}
                  <div
                    className="size-10 shrink-0 rounded-lg border-2 border-border"
                    style={{ backgroundColor: avatarColor }}
                    title="Your avatar color"
                    aria-label={`Avatar color: ${avatarColor}`}
                  />
                  <Input
                    id="display-name"
                    name="display-name"
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

              <Button type="submit" className="h-9">
                Update Profile
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
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
                width="315"
              />
            </div>
            {error ? (
              <p className="text-xs text-destructive text-center">{error}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
