import { useEffect } from "react"
import { getSocket } from "@/lib/socket/socket"
import { ServerEvents } from "@rctw/shared-contracts"
import type { CursorMovedEvent } from "@rctw/shared-contracts"
import { useCursorStore } from "../store/cursor.store"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import { getAvatarColor } from "@/lib/utils"

export function useCursorSync(boardId: string) {
  useEffect(() => {
    const socket = getSocket()

    const handleCursorMoved = (event: CursorMovedEvent) => {
      if (event.boardId !== boardId) return

      const onlineUsers = useBoardStore.getState().onlineUsers
      const userProfile = onlineUsers.find((u) => u.id === event.user.id)

      const avatarColor = getAvatarColor(event.user.id)
      const avatarUrl = userProfile?.avatarUrl || undefined

      // Update cursor store
      useCursorStore.getState().updateCursor(event.user.id, {
        name: event.user.name,
        avatarColor,
        avatarUrl,
        x: event.x,
        y: event.y,
        lastActive: Date.now(),
      })

      // If we are following this user, sync our viewport to their viewport or center on cursor
      const followingUserId = useUIStore.getState().followingUserId
      if (followingUserId === event.user.id) {
        const { viewport, setViewport } = useUIStore.getState()
        if (
          event.viewportCenterX !== undefined &&
          event.viewportCenterY !== undefined &&
          event.viewportScale !== undefined
        ) {
          const targetScale = event.viewportScale
          const newX = window.innerWidth / 2 - event.viewportCenterX * targetScale
          const newY = window.innerHeight / 2 - event.viewportCenterY * targetScale
          setViewport({
            x: newX,
            y: newY,
            scale: targetScale,
          })
        } else {
          // Fallback to legacy behavior: center on their cursor
          const newX = window.innerWidth / 2 - event.x * viewport.scale
          const newY = window.innerHeight / 2 - event.y * viewport.scale
          setViewport({
            x: newX,
            y: newY,
            scale: viewport.scale,
          })
        }
      }
    }

    socket.on(ServerEvents.CURSOR_MOVED, handleCursorMoved)

    return () => {
      socket.off(ServerEvents.CURSOR_MOVED, handleCursorMoved)
    }
  }, [boardId])
}
