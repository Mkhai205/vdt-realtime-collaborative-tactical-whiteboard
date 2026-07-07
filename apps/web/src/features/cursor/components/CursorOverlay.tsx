"use client"

import { useCursorStore } from "../store/cursor.store"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import { RemoteCursor } from "./RemoteCursor"
import { useCursorSync } from "../hooks/useCursorSync"
import { useLaserSync } from "../hooks/useLaserSync"

export function CursorOverlay({ boardId }: { boardId: string }) {
  useCursorSync(boardId)
  useLaserSync(boardId)
  const cursors = useCursorStore((s) => s.cursors)
  const onlineUsers = useBoardStore((s) => s.onlineUsers)
  const { viewport } = useUIStore()

  const onlineUserIds = new Set(onlineUsers.map((u) => u.id))
  const activeCursors = [...cursors.values()].filter((c) =>
    onlineUserIds.has(c.userId)
  )

  return (
    <div
      id="cursor-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {activeCursors.map((cursor) => {
        const screenX = cursor.x * viewport.scale + viewport.x
        const screenY = cursor.y * viewport.scale + viewport.y
        return (
          <RemoteCursor
            key={cursor.userId}
            name={cursor.name}
            avatarColor={cursor.avatarColor}
            screenX={screenX}
            screenY={screenY}
          />
        )
      })}
    </div>
  )
}
