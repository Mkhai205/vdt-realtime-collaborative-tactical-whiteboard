/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { type BoardSummary as RoomSummary } from "@rctw/shared-contracts"
import {
  ArrowRight,
  Compass,
  Globe,
  Lock,
  Loader2,
  LogIn,
  Plus,
  Search,
  Users,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { listRooms, getApiErrorMessage } from "@/lib/room-api"
import { RoomCreateDialog } from "./room-create-dialog"

export function RoomList() {
  const router = useRouter()

  // Available rooms list state
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomsError, setRoomsError] = useState("")
  const [search, setSearch] = useState("")

  // Join room by ID state
  const [joinRoomId, setJoinRoomId] = useState("")
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)
  const [joinRoomError, setJoinRoomError] = useState("")

  // Fetch rooms list
  useEffect(() => {
    let isCurrent = true

    async function fetchRooms() {
      setLoadingRooms(true)
      setRoomsError("")
      try {
        const response = await listRooms()
        if (isCurrent) {
          setRooms(response.items)
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
  }, [])

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const roomId = joinRoomId.trim()
    if (!roomId) {
      setJoinRoomError("Room ID is required.")
      return
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roomId)) {
      setJoinRoomError("Please enter a valid Room UUID.")
      return
    }

    setIsJoiningRoom(true)
    setJoinRoomError("")
    try {
      router.push(`/rooms/${roomId}`)
    } catch {
      setJoinRoomError("Failed to navigate to room.")
      setIsJoiningRoom(false)
    }
  }

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(search.toLowerCase()) ||
    (room.description ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Dashboard header */}
      <div className="flex items-center justify-between gap-4 px-8 pt-8 pb-6 border-b">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Whiteboard Rooms
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loadingRooms
              ? "Loading rooms…"
              : rooms.length === 0
                ? "No rooms yet — create your first board"
                : `${rooms.length} room${rooms.length !== 1 ? "s" : ""} available`}
          </p>
        </div>
        <RoomCreateDialog />
      </div>

      {/* Filters & search */}
      <div className="flex items-center gap-3 px-8 py-4 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm bg-background"
            aria-label="Search rooms"
          />
        </div>

        {/* Join by ID */}
        <form onSubmit={handleJoinRoom} className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={joinRoomId}
              onChange={(e) => {
                setJoinRoomId(e.target.value)
                setJoinRoomError("")
              }}
              placeholder="Paste Room UUID…"
              className="h-8 text-sm font-mono w-60 bg-background"
              aria-label="Room UUID to join"
              aria-invalid={Boolean(joinRoomError)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            disabled={isJoiningRoom || !joinRoomId.trim()}
          >
            {isJoiningRoom ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogIn className="size-3.5" />
            )}
            Join
          </Button>
        </form>
        {joinRoomError && (
          <p className="text-xs text-destructive shrink-0">{joinRoomError}</p>
        )}
      </div>

      {/* Room grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loadingRooms ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Loading rooms…</p>
          </div>
        ) : roomsError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="text-sm text-destructive">{roomsError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
              <Compass className="size-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {search ? "No rooms match your search" : "No rooms yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {search
                  ? "Try a different keyword or clear the search."
                  : "Create your first whiteboard room to get started."}
              </p>
            </div>
            {!search && <RoomCreateDialog />}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => router.push(`/rooms/${room.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RoomCard({
  room,
  onClick,
}: {
  room: RoomSummary
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-xl border bg-card px-5 py-4 card-hover flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Open room: ${room.name}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate group-hover:text-foreground transition-colors">
              {room.name}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 py-0.5 border shrink-0 text-muted-foreground">
              {room.isPublic ? (
                <>
                  <Globe className="size-2.5" aria-hidden="true" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="size-2.5" aria-hidden="true" />
                  Private
                </>
              )}
            </span>
          </div>
          {room.description && (
            <p className="text-xs text-muted-foreground truncate leading-relaxed">
              {room.description}
            </p>
          )}
        </div>
        <ChevronRight
          className="size-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150"
          aria-hidden="true"
        />
      </div>

      {/* Footer meta */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3" aria-hidden="true" />
          {room.createdBy.name}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          Rev {room.currentRevision}
        </span>
      </div>
    </button>
  )
}
