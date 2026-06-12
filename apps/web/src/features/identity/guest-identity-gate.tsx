"use client"

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react"
import { authTokenStorageKey } from "@rctw/shared-contracts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { googleOAuthStartUrl } from "@/lib/api-url"
import {
  clearStoredAuthToken,
  readStoredAuthToken,
  subscribeStoredAuthToken,
} from "./auth-token"
import {
  clearStoredGuestIdentity,
  createGuestIdentity,
  generateGuestAvatarColor,
  readStoredGuestIdentity,
  subscribeStoredGuestIdentity,
  writeStoredGuestIdentity,
} from "./guest-identity"

const previewSeed = "rctw-preview"

export function GuestIdentityGate() {
  const authToken = useSyncExternalStore(
    subscribeStoredAuthToken,
    readStoredAuthToken,
    () => null
  )
  const identity = useSyncExternalStore(
    subscribeStoredGuestIdentity,
    readStoredGuestIdentity,
    () => null
  )
  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null)
  const [error, setError] = useState("")

  const displayName = draftDisplayName ?? identity?.name ?? ""

  const avatarColor = useMemo(
    () => identity?.avatarColor ?? generateGuestAvatarColor(previewSeed),
    [identity?.avatarColor]
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextName = displayName.trim()

    if (!nextName) {
      setError("Enter a display name before joining.")
      return
    }

    const nextIdentity = createGuestIdentity(nextName, identity)
    writeStoredGuestIdentity(nextIdentity)
    setDraftDisplayName(nextIdentity.name)
    setError("")
  }

  function handleClear() {
    clearStoredGuestIdentity()
    setDraftDisplayName("")
    setError("")
  }

  function handleLogout() {
    clearStoredAuthToken()
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-10">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium tracking-[0.22em] text-muted-foreground uppercase">
            Tactical Whiteboard
          </p>
          <div className="flex max-w-3xl flex-col gap-4">
            <h1 className="text-4xl leading-tight font-semibold text-balance md:text-6xl">
              Identify your guest session before entering the board.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Your name and color stay in this browser so room APIs and future
              realtime connections can resolve the same guest after refresh.
              Google sign-in upgrades the session with a Bearer token.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="shadow-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
              <CardContent className="flex flex-col gap-5 p-0">
                <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">
                        {authToken ? "Google session active" : "Sign in with Google"}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {authToken
                          ? "REST and future socket auth will use the JWT before guest headers."
                          : "Use a verified Google account for authenticated room identity."}
                      </p>
                    </div>
                    {authToken ? (
                      <Button type="button" variant="outline" onClick={handleLogout}>
                        Log out
                      </Button>
                    ) : (
                      <Button asChild>
                        <a href={googleOAuthStartUrl}>Continue with Google</a>
                      </Button>
                    )}
                  </div>
                </div>

                <Field>
                  <FieldLabel htmlFor="guest-display-name">Display name</FieldLabel>
                  <Input
                    id="guest-display-name"
                    name="guest-display-name"
                    value={displayName}
                    onChange={(event) => {
                      setDraftDisplayName(event.target.value)
                      setError("")
                    }}
                    placeholder="Example: Alpha Lead"
                    maxLength={120}
                    aria-invalid={Boolean(error)}
                    className="h-11"
                  />
                  {error ? (
                    <FieldDescription className="text-destructive">
                      {error}
                    </FieldDescription>
                  ) : null}
                </Field>

                <div className="flex flex-col gap-3 rounded-md border bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="size-10 rounded-md border"
                      style={{ backgroundColor: avatarColor }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {identity?.name ?? "Guest preview"}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {identity?.id ?? "Identity will be created on submit"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Color is generated once per guest session and is reused for
                    presence, cursors, REST headers, and future socket auth when no
                    JWT is active.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit">
                    {identity ? "Update guest" : "Create guest"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!identity}
                    onClick={handleClear}
                  >
                    Clear session
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>

          <Card className="flex flex-col justify-between gap-6 bg-secondary p-5 border-none shadow-none">
            <CardHeader className="p-0 gap-3">
              <CardTitle className="text-sm font-medium text-secondary-foreground">
                Current status
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={authToken ? "default" : identity ? "secondary" : "outline"} className="flex gap-1.5 items-center">
                  <span
                    className="size-2 rounded-full bg-current"
                    aria-hidden="true"
                  />
                  {authToken
                    ? "Google Active"
                    : identity
                      ? "Guest Active"
                      : "Inactive"}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {authToken
                    ? "JWT takes precedence."
                    : identity
                      ? "Guest ready for room APIs."
                      : "No guest identity saved."}
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">REST headers</dt>
                  <dd className="font-mono text-xs break-all text-secondary-foreground">
                    {authToken
                      ? "Authorization: Bearer <token>"
                      : "x-guest-id, x-guest-name, x-guest-avatar-color"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Storage keys</dt>
                  <dd className="font-mono text-xs break-all text-secondary-foreground">
                    {authTokenStorageKey}, rctw.guestIdentity.v1
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
