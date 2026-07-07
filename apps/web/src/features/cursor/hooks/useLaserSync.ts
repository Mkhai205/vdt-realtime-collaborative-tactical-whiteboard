import { useEffect } from "react"
import { getSocket } from "@/lib/socket/socket"
import { ServerEvents } from "@rctw/shared-contracts"
import type { LaserMovedEvent } from "@rctw/shared-contracts"
import { useLaserStore } from "../store/laser.store"

/**
 * Subscribes to laser:moved server events for a given board.
 *
 * - laser:moved with isActive=true → adds a point to the remote trail buffer
 * - laser:moved with isActive=false → clears that user's trail (they exited laser mode)
 *
 * Mount this hook alongside useCursorSync in CursorOverlay.
 */
export function useLaserSync(boardId: string) {
  useEffect(() => {
    const socket = getSocket()

    const handleLaserMoved = (event: LaserMovedEvent) => {
      if (event.boardId !== boardId) return

      if (!event.isActive) {
        // Ignore dummy stop event, letting the existing trail decay naturally
        return
      }

      useLaserStore.getState().addLaserPoint(
        event.user.id,
        event.user.name,
        event.avatarColor,
        event.x,
        event.y,
        event.strokeId,
      )
    }

    socket.on(ServerEvents.LASER_MOVED, handleLaserMoved)

    return () => {
      socket.off(ServerEvents.LASER_MOVED, handleLaserMoved)
    }
  }, [boardId])
}
