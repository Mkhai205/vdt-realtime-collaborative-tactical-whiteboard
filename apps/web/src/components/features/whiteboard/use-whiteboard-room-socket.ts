"use client"

import { useEffect } from "react"
import { useShallow } from "zustand/react/shallow"
import { createWhiteboardSocket } from "@/lib/socket-client"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { selectSocketActions } from "@/stores/whiteboard-store/selectors"
import { WhiteboardRoomSocketSession } from "./whiteboard-room-socket-session"

export function useWhiteboardRoomSocket(roomId: string): void {
  const actions = useWhiteboardStore(useShallow(selectSocketActions))

  useEffect(() => {
    const socket = createWhiteboardSocket()
    const session = new WhiteboardRoomSocketSession(socket, roomId, {
      ...actions,
      getLastSeenRevision: () => useWhiteboardStore.getState().lastSeenRevision,
    })

    session.connect()

    return () => {
      session.disconnect()
    }
  }, [actions, roomId])
}
