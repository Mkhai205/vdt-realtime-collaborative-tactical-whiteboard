"use client"

import type { CSSProperties } from "react"
import type { OnlineUser } from "@rctw/shared-contracts"
import { UsersRoundIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"

type PresenceAvatarStyle = CSSProperties & {
  "--presence-avatar-color"?: string
  "--presence-avatar-foreground"?: string
}

export function OnlineUsersPanel() {
  const onlineUsers = useWhiteboardStore((state) => state.onlineUsers)
  const currentUserId = useWhiteboardStore((state) => state.currentUser?.id)
  const userCount = onlineUsers.length

  return (
    <Card className="shrink-0 shadow-sm" size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <UsersRoundIcon data-icon="inline-start" />
            Online users
          </CardTitle>
          <Badge variant="secondary">{userCount}</Badge>
        </div>
        <CardDescription>
          {userCount === 1
            ? "1 user in this room"
            : `${userCount} users in this room`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {onlineUsers.length > 0 ? (
          <ul
            className="flex max-h-56 flex-col gap-2 overflow-y-auto"
            aria-label="Online users"
          >
            {onlineUsers.map((user) => (
              <OnlineUserRow
                key={user.id}
                user={user}
                isCurrentUser={user.id === currentUserId}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            No users are currently online.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function OnlineUserRow({
  user,
  isCurrentUser,
}: {
  user: OnlineUser
  isCurrentUser: boolean
}) {
  const avatarStyle = getAvatarStyle(user.avatarColor)

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase",
          avatarStyle
            ? "bg-[var(--presence-avatar-color)] text-[var(--presence-avatar-foreground)]"
            : "bg-muted text-muted-foreground",
        )}
        style={avatarStyle}
        aria-hidden="true"
      >
        {getInitials(user.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{user.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          Connected {formatConnectedAt(user.connectedAt)}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
        <Badge variant={roleBadgeVariant(user.role)}>
          {formatRole(user.role)}
        </Badge>
      </span>
    </li>
  )
}

function getAvatarStyle(
  avatarColor: string | null | undefined,
): PresenceAvatarStyle | undefined {
  if (!avatarColor) {
    return undefined
  }

  return {
    "--presence-avatar-color": avatarColor,
    "--presence-avatar-foreground": getReadableTextColor(avatarColor),
  }
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

  return initials || "U"
}

function formatConnectedAt(connectedAt: string): string {
  const date = new Date(connectedAt)

  if (Number.isNaN(date.getTime())) {
    return "now"
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function roleBadgeVariant(
  role: OnlineUser["role"],
): "default" | "outline" | "secondary" {
  switch (role) {
    case "OWNER":
      return "default"
    case "EDITOR":
      return "secondary"
    case "VIEWER":
      return "outline"
  }
}

function formatRole(role: OnlineUser["role"]): string {
  switch (role) {
    case "OWNER":
      return "Owner"
    case "EDITOR":
      return "Editor"
    case "VIEWER":
      return "Viewer"
  }
}

function getReadableTextColor(color: string): string {
  const hex = normalizeHexColor(color)

  if (!hex) {
    return "#ffffff"
  }

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.6 ? "#172018" : "#ffffff"
}

function normalizeHexColor(color: string): string | null {
  const trimmedColor = color.trim().replace(/^#/, "")

  if (/^[0-9a-f]{6}$/i.test(trimmedColor)) {
    return trimmedColor
  }

  if (/^[0-9a-f]{3}$/i.test(trimmedColor)) {
    return trimmedColor
      .split("")
      .map((character) => character + character)
      .join("")
  }

  return null
}
