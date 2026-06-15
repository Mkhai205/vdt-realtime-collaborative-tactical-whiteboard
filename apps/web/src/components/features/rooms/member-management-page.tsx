"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { ShieldIcon, UserPlusIcon, UsersIcon } from "lucide-react"
import type {
  GetRoomResponse,
  MemberRoleInput,
  RoomMemberSummary,
  RoomSummary,
} from "@rctw/shared-contracts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addRoomMember,
  getApiErrorMessage,
  getRoom,
  getRoomMembers,
  updateRoomMemberRole,
} from "@/lib/room-api"

type LoadState = "loading" | "ready" | "error"
type CurrentUserWithRole = GetRoomResponse["currentUser"]

const memberRoleOptions: MemberRoleInput[] = ["EDITOR", "VIEWER"]
const joinedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

export function MemberManagementPage({ roomId }: { roomId: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [room, setRoom] = useState<RoomSummary | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUserWithRole | null>(
    null
  )
  const [members, setMembers] = useState<RoomMemberSummary[]>([])
  const [draftUserId, setDraftUserId] = useState("")
  const [draftRole, setDraftRole] = useState<MemberRoleInput>("EDITOR")
  const [pendingAdd, setPendingAdd] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const isOwner = currentUser?.role === "OWNER"
  const memberCount = members.length
  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "OWNER").length,
    [members]
  )

  useEffect(() => {
    let isCurrent = true

    async function loadRoomMembers() {
      setLoadState("loading")
      setError("")
      setMessage("")

      try {
        const [roomResponse, membersResponse] = await Promise.all([
          getRoom(roomId),
          getRoomMembers(roomId),
        ])

        if (!isCurrent) {
          return
        }

        setRoom(roomResponse.room)
        setCurrentUser(roomResponse.currentUser)
        setMembers(membersResponse.members)
        setLoadState("ready")
      } catch (loadError) {
        if (!isCurrent) {
          return
        }

        setError(getApiErrorMessage(loadError))
        setLoadState("error")
      }
    }

    void loadRoomMembers()

    return () => {
      isCurrent = false
    }
  }, [roomId])

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const userId = draftUserId.trim()

    if (!userId) {
      setError("User ID is required.")
      return
    }

    setPendingAdd(true)
    setError("")
    setMessage("")

    try {
      const response = await addRoomMember(roomId, {
        userId,
        role: draftRole,
      })

      setMembers((currentMembers) =>
        upsertMember(currentMembers, response.member)
      )
      setDraftUserId("")
      setMessage(`${response.member.user.name} is now ${response.member.role}.`)
    } catch (addError) {
      setError(getApiErrorMessage(addError))
    } finally {
      setPendingAdd(false)
    }
  }

  async function handleRoleChange(
    member: RoomMemberSummary,
    role: MemberRoleInput
  ) {
    if (member.role === role || member.role === "OWNER") {
      return
    }

    setPendingMemberId(member.id)
    setError("")
    setMessage("")

    try {
      const response = await updateRoomMemberRole(roomId, member.id, {
        role,
      })

      setMembers((currentMembers) =>
        upsertMember(currentMembers, response.member)
      )
      setMessage(`${response.member.user.name} is now ${response.member.role}.`)
    } catch (updateError) {
      setError(getApiErrorMessage(updateError))
    } finally {
      setPendingMemberId(null)
    }
  }

  if (loadState === "loading") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
          <Card className="w-full" size="sm">
            <CardHeader>
              <CardTitle>Loading members</CardTitle>
              <CardDescription>{roomId}</CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    )
  }

  if (loadState === "error") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
          <Card className="w-full" size="sm">
            <CardHeader>
              <CardTitle>Room access unavailable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={room?.isPublic ? "secondary" : "outline"}>
                {room?.isPublic ? "Public" : "Private"}
              </Badge>
              {currentUser ? (
                <Badge variant="secondary">{currentUser.role}</Badge>
              ) : null}
            </div>
            <h1 className="text-3xl leading-tight font-semibold text-balance md:text-4xl">
              {room?.name ?? "Room members"}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {roomId}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Members" value={memberCount} icon="users" />
            <Metric label="Owners" value={ownerCount} icon="shield" />
            <Metric
              label="Default"
              value={room?.defaultJoinRole ?? "EDITOR"}
              icon="role"
            />
          </div>
        </div>

        {message ? (
          <div className="rounded-lg border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Add member</CardTitle>
              <CardDescription>
                {isOwner ? "Direct userId invite" : "Owner-only action"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMember} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="add-member-userid">User ID</FieldLabel>
                  <Input
                    id="add-member-userid"
                    value={draftUserId}
                    disabled={!isOwner || pendingAdd}
                    onChange={(event) => setDraftUserId(event.target.value)}
                    placeholder="00000000-0000-4000-8000-000000000000"
                    aria-invalid={Boolean(error)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="add-member-role">Role</FieldLabel>
                  <Select
                    value={draftRole}
                    disabled={!isOwner || pendingAdd}
                    onValueChange={(value) =>
                      setDraftRole(value as MemberRoleInput)
                    }
                  >
                    <SelectTrigger id="add-member-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {memberRoleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Button type="submit" disabled={!isOwner || pendingAdd}>
                  <UserPlusIcon data-icon="inline-start" />
                  {pendingAdd ? "Adding" : "Add member"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Active members</CardTitle>
              <CardDescription>{memberCount} visible</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex min-w-40 items-center gap-2">
                          <span
                            className="size-3 shrink-0 rounded-full border"
                            style={{
                              backgroundColor:
                                member.user.avatarColor ?? "transparent",
                            }}
                            aria-hidden="true"
                          />
                          <span className="truncate font-medium">
                            {member.user.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-72 truncate font-mono text-xs text-muted-foreground">
                        {member.user.id}
                      </TableCell>
                      <TableCell>
                        {isOwner && member.role !== "OWNER" ? (
                          <Select
                            value={member.role}
                            disabled={pendingMemberId === member.id}
                            onValueChange={(value) =>
                              void handleRoleChange(
                                member,
                                value as MemberRoleInput
                              )
                            }
                          >
                            <SelectTrigger size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {memberRoleOptions.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={
                              member.role === "OWNER" ? "default" : "secondary"
                            }
                          >
                            {member.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatJoinedAt(member.joinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: "role" | "shield" | "users"
  label: string
  value: number | string
}) {
  const Icon =
    icon === "users" ? UsersIcon : icon === "shield" ? ShieldIcon : UserPlusIcon

  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function upsertMember(
  members: RoomMemberSummary[],
  member: RoomMemberSummary
): RoomMemberSummary[] {
  return [...members.filter((item) => item.id !== member.id), member].sort(
    (left, right) => left.joinedAt.localeCompare(right.joinedAt)
  )
}

function formatJoinedAt(value: string): string {
  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return value
  }

  return joinedAtFormatter.format(timestamp)
}
