"use client"

import * as React from "react"
import { useBoardStore } from "@/stores/board.store"
import { useAuthStore } from "@/stores/auth.store"
import { useUIStore } from "@/stores/ui.store"
import { useCursorStore } from "../../cursor/store/cursor.store"
import { UserAvatar } from "./UserAvatar"
import { AnimatePresence, motion } from "framer-motion"
import { getAvatarColor } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const MAX_AVATARS = 5

export function PresenceBar() {
  const onlineUsers = useBoardStore((s) => s.onlineUsers)
  const editingStates = useBoardStore((s) => s.editingStates)

  const followingUserId = useUIStore((s) => s.followingUserId)
  const setFollowingUserId = useUIStore((s) => s.setFollowingUserId)
  const currentUser = useAuthStore((s) => s.user)

  // Toggling Follow Mode
  const handleToggleFollow = (userId: string) => {
    if (currentUser && userId === currentUser.id) return // Cannot follow self

    if (followingUserId === userId) {
      setFollowingUserId(null)
    } else {
      setFollowingUserId(userId)
      // Center viewport immediately on cursor if position is known
      const cursors = useCursorStore.getState().cursors
      const userCursor = cursors.get(userId)
      if (userCursor) {
        const { viewport, setViewport } = useUIStore.getState()
        const newX = window.innerWidth / 2 - userCursor.x * viewport.scale
        const newY = window.innerHeight / 2 - userCursor.y * viewport.scale
        setViewport({
          x: newX,
          y: newY,
          scale: viewport.scale,
        })
      }
    }
  }

  // Calculate displayed users and remaining count
  const displayedUsers = onlineUsers.slice(0, MAX_AVATARS)
  const extraCount =
    onlineUsers.length > MAX_AVATARS ? onlineUsers.length - MAX_AVATARS : 0

  return (
    <TooltipProvider delayDuration={200}>
      <div
        id="presence-bar"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-md select-none dark:bg-card/85"
      >
        <div className="flex items-center -space-x-1.5 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {displayedUsers.map((user) => {
              const isSelf = !!(currentUser && user.id === currentUser.id)
              const isFollowing = followingUserId === user.id
              const isEditing = [...editingStates.values()].some(
                (entry) => entry.user.id === user.id,
              )
              const avatarColor = getAvatarColor(user.id)

              return (
                <motion.div
                  key={user.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -10 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="relative"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleToggleFollow(user.id)}
                        disabled={isSelf}
                        style={{
                          borderColor: isEditing ? avatarColor : "transparent",
                          borderStyle: isEditing ? "dashed" : "solid",
                        }}
                        className={`relative rounded-full border-2 p-0.5 outline-hidden transition-all ${
                          isSelf
                            ? "cursor-default"
                            : "cursor-pointer hover:scale-105 active:scale-95"
                        } ${
                          isFollowing
                            ? "ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-card"
                            : ""
                        }`}
                      >
                        <UserAvatar user={user} size="sm" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="flex flex-col gap-0.5"
                    >
                      <span className="font-semibold">
                        {user.name} {isSelf && " (You)"}
                      </span>
                      {isEditing && (
                        <span className="text-sm text-muted-foreground">
                          ✏️ Currently editing shapes
                        </span>
                      )}
                      {!isSelf && (
                        <span className="text-sm text-emerald-400">
                          {isFollowing
                            ? "Following — click to unfollow"
                            : "Click to follow cursor"}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Extra count indicator */}
        {extraCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="ml-1 flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-border bg-muted font-bold text-muted-foreground hover:bg-muted/80">
                +{extraCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>{extraCount} more users online</span>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Active following banner inside header if any user is followed */}
        {followingUserId && (
          <div className="ml-2 flex animate-pulse items-center gap-1.5 border-l border-border pl-2 font-medium text-emerald-600 dark:text-emerald-400">
            <span>Following</span>
            <button
              onClick={() => setFollowingUserId(null)}
              className="ml-0.5 cursor-pointer rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-sm hover:bg-emerald-500/20"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
