"use client"

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { authTokenStorageKey, type RoomSummary } from "@rctw/shared-contracts"
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
import { Plus, ArrowRight, Loader2, Compass, LogIn } from "lucide-react"
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
import { createRoom, listRooms, getApiErrorMessage } from "../rooms/room-api"

const previewSeed = "rctw-preview"

export function GuestIdentityGate() {
  const router = useRouter()
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

  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomsError, setRoomsError] = useState("")

  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomDescription, setNewRoomDescription] = useState("")
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createRoomError, setCreateRoomError] = useState("")

  const [joinRoomId, setJoinRoomId] = useState("")
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)
  const [joinRoomError, setJoinRoomError] = useState("")

  const isActive = Boolean(authToken) || Boolean(identity)

  useEffect(() => {
    if (!isActive) {
      setRooms([])
      return
    }

    let isCurrent = true

    async function fetchRooms() {
      setLoadingRooms(true)
      setRoomsError("")
      try {
        const response = await listRooms()
        if (isCurrent) {
          setRooms(response.rooms)
        }
      } catch (err) {
        if (isCurrent) {
          setRoomsError(getApiErrorMessage(err))
        }
      } finally {
        if (isCurrent) {
          setLoadingRooms(false)
        }
      }
    }

    fetchRooms()

    return () => {
      isCurrent = false
    }
  }, [isActive])

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newRoomName.trim()
    if (!name) {
      setCreateRoomError("Room name is required.")
      return
    }

    setIsCreatingRoom(true)
    setCreateRoomError("")
    try {
      const response = await createRoom({
        name,
        description: newRoomDescription.trim() || undefined,
        isPublic: true,
        defaultJoinRole: "EDITOR",
      })
      router.push(`/rooms/${response.room.id}`)
    } catch (err) {
      setCreateRoomError(getApiErrorMessage(err))
      setIsCreatingRoom(false)
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const roomId = joinRoomId.trim()
    if (!roomId) {
      setJoinRoomError("Room ID is required.")
      return
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roomId)) {
      setJoinRoomError("Please enter a valid Room UUID.")
      return
    }

    setIsJoiningRoom(true)
    setJoinRoomError("")
    try {
      router.push(`/rooms/${roomId}`)
    } catch (err) {
      setJoinRoomError("Failed to navigate to room.")
      setIsJoiningRoom(false)
    }
  }

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

        {/* New Rooms Section when session is active */}
        {isActive && (
          <div className="flex flex-col gap-6 border-t pt-8 mt-4 animate-in fade-in duration-300">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">Whiteboard Rooms</h2>
              <p className="text-sm text-muted-foreground">
                Create a new whiteboard or join an existing session below.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Left Column: Create or Join Room */}
              <div className="flex flex-col gap-5">
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Plus className="size-5 text-primary" />
                      Create a Room
                    </CardTitle>
                  </CardHeader>
                  <form onSubmit={handleCreateRoom}>
                    <CardContent className="flex flex-col gap-4">
                      <Field>
                        <FieldLabel htmlFor="room-name">Room name</FieldLabel>
                        <Input
                          id="room-name"
                          name="room-name"
                          value={newRoomName}
                          onChange={(e) => {
                            setNewRoomName(e.target.value)
                            setCreateRoomError("")
                          }}
                          placeholder="e.g. Sprint Planning Board"
                          maxLength={160}
                          className="h-10"
                        />
                      </Field>
                      
                      <Field>
                        <FieldLabel htmlFor="room-description">Description (optional)</FieldLabel>
                        <Input
                          id="room-description"
                          name="room-description"
                          value={newRoomDescription}
                          onChange={(e) => {
                            setNewRoomDescription(e.target.value)
                            setCreateRoomError("")
                          }}
                          placeholder="e.g. Workspace for detailing weekly goals"
                          maxLength={500}
                          className="h-10"
                        />
                      </Field>

                      {createRoomError && (
                        <p className="text-xs text-destructive">{createRoomError}</p>
                      )}

                      <Button type="submit" className="w-full" disabled={isCreatingRoom}>
                        {isCreatingRoom ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Room"
                        )}
                      </Button>
                    </CardContent>
                  </form>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <LogIn className="size-5 text-primary" />
                      Join Room by ID
                    </CardTitle>
                  </CardHeader>
                  <form onSubmit={handleJoinRoom}>
                    <CardContent className="flex flex-col gap-4">
                      <Field>
                        <FieldLabel htmlFor="join-room-id">Room UUID</FieldLabel>
                        <Input
                          id="join-room-id"
                          name="join-room-id"
                          value={joinRoomId}
                          onChange={(e) => {
                            setJoinRoomId(e.target.value)
                            setJoinRoomError("")
                          }}
                          placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                          className="h-10 font-mono text-sm"
                        />
                      </Field>

                      {joinRoomError && (
                        <p className="text-xs text-destructive">{joinRoomError}</p>
                      )}

                      <Button type="submit" variant="outline" className="w-full" disabled={isJoiningRoom}>
                        {isJoiningRoom ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Joining...
                          </>
                        ) : (
                          "Join Room"
                        )}
                      </Button>
                    </CardContent>
                  </form>
                </Card>
              </div>

              {/* Right Column: Available Rooms */}
              <Card className="shadow-sm flex flex-col min-h-[300px]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="size-5 text-primary" />
                      Available Rooms
                    </div>
                    {rooms.length > 0 && (
                      <Badge variant="secondary">{rooms.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {loadingRooms ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      Loading active rooms...
                    </div>
                  ) : roomsError ? (
                    <div className="flex-1 flex items-center justify-center py-12 text-sm text-destructive text-center">
                      {roomsError}
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-sm text-muted-foreground text-center gap-2">
                      <Compass className="h-10 w-10 text-muted-foreground/50 stroke-[1.5]" />
                      <div className="font-medium">No rooms available</div>
                      <div className="text-xs max-w-xs">Create your first room using the form on the left.</div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
                      {rooms.map((roomItem) => (
                        <div
                          key={roomItem.id}
                          onClick={() => router.push(`/rooms/${roomItem.id}`)}
                          className="group flex items-center justify-between p-3.5 rounded-lg border hover:bg-muted/50 transition-all duration-150 cursor-pointer"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                {roomItem.name}
                              </span>
                              {roomItem.isPublic ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Public</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-500">Private</Badge>
                              )}
                            </div>
                            {roomItem.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-sm">
                                {roomItem.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>By {roomItem.createdBy.name}</span>
                              <span>•</span>
                              <span>Rev {roomItem.currentRevision}</span>
                            </div>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
