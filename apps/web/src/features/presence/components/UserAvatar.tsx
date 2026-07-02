"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserSummary } from "@rctw/shared-contracts"
import { cn } from "@/lib/utils"
import { User } from "lucide-react"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const firstPart = parts[0]
  if (!firstPart) return "?"
  if (parts.length === 1) return firstPart.substring(0, 2).toUpperCase()

  const first = firstPart[0] || ""
  const lastPart = parts[parts.length - 1]
  const last = lastPart ? (lastPart[0] || "") : ""
  return (first + last).toUpperCase()
}

export interface UserAvatarProps {
  user: UserSummary
  size?: "sm" | "md" | "lg"
  showName?: boolean
  className?: string
  style?: React.CSSProperties
}

export function UserAvatar({
  user,
  size = "md",
  showName = false,
  className,
  style,
}: UserAvatarProps) {
  const initials = getInitials(user.name)
  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  }

  const avatarColor = user.avatarColor || "#6366f1"

  return (
    <div className={cn("flex items-center gap-2", className)} style={style}>
      <Avatar className={cn(sizeClasses[size], "border border-border shadow-xs shrink-0")}>
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
        <AvatarFallback
          style={{ backgroundColor: avatarColor, color: "#ffffff" }}
          className="font-semibold uppercase"
        >
          {initials || <User className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      {showName && <span className="font-medium text-sm text-foreground">{user.name}</span>}
    </div>
  )
}
