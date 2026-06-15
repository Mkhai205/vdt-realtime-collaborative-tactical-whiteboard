"use client"

import type { CSSProperties } from "react"
import type { OnlineUser } from "@rctw/shared-contracts"
import { readableForegroundColor } from "@/lib/color-utils"
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
    <div className="flex flex-col gap-0 p-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-2 mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Online
        </p>
        <span className="text-xs font-semibold text-foreground tabular-nums">
          {userCount}
        </span>
      </div>

      {/* User list */}
      {onlineUsers.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Online users">
          {onlineUsers.map((user) => (
            <OnlineUserRow
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-base">👤</span>
          </div>
          <p className="text-xs text-muted-foreground">No other users online</p>
        </div>
      )}
    </div>
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
    <li className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/60 transition-colors">
      {/* Avatar */}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase",
          avatarStyle
            ? "bg-(--presence-avatar-color) text-(--presence-avatar-foreground)"
            : "bg-muted text-muted-foreground",
        )}
        style={avatarStyle}
        aria-hidden="true"
      >
        {getInitials(user.name)}
      </span>

      {/* Info */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-xs font-medium text-foreground">
            {user.name}
          </span>
          {isCurrentUser && (
            <span className="text-[9px] font-medium text-muted-foreground shrink-0">(you)</span>
          )}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {formatRole(user.role)}
        </span>
      </span>

      {/* Online indicator */}
      <span
        className="size-1.5 rounded-full bg-emerald-500 shrink-0 presence-pulse"
        aria-label="Online"
        title="Online"
      />
    </li>
  )
}

function getAvatarStyle(
  avatarColor: string | null | undefined,
): PresenceAvatarStyle | undefined {
  if (!avatarColor) return undefined

  return {
    "--presence-avatar-color": avatarColor,
    "--presence-avatar-foreground": readableForegroundColor(avatarColor, "#ffffff"),
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

function formatRole(role: OnlineUser["role"]): string {
  switch (role) {
    case "OWNER": return "Owner"
    case "EDITOR": return "Editor"
    case "VIEWER": return "Viewer"
  }
}
