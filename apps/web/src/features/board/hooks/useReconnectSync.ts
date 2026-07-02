"use client"

import { useEffect, useCallback } from "react"
import { useBoardStore } from "@/stores/board.store"
import { getSocket } from "@/lib/socket/socket"
import { ClientEvents, ServerEvents } from "@rctw/shared-contracts"
import type {
  BoardOperationDto,
  BoardObjectDto,
  SyncResponse,
} from "@rctw/shared-contracts"

export function useReconnectSync(boardId: string) {
  const { revision, objects, upsertObject, removeObject, setRevision } =
    useBoardStore()

  const applySyncDelta = useCallback(
    (operations: BoardOperationDto[]) => {
      // Sort operations by revision ascending
      const sorted = [...operations].sort((a, b) => a.revision - b.revision)

      for (const op of sorted) {
        if (!op.objectId) continue

        switch (op.type) {
          case "OBJECT_CREATE":
          case "OBJECT_RESTORE": {
            if (op.payload) {
              upsertObject(op.payload as BoardObjectDto)
            }
            break
          }
          case "OBJECT_UPDATE": {
            const current = objects.get(op.objectId)
            if (current && op.payload) {
              upsertObject({
                ...current,
                ...(op.payload as Partial<BoardObjectDto>),
                id: current.id, // keep original ID
                version:
                  (op.payload as { version?: number }).version ??
                  current.version + 1,
              })
            }
            break
          }
          case "OBJECT_DELETE": {
            removeObject(op.objectId)
            break
          }
          default:
            break
        }
      }
    },
    [objects, upsertObject, removeObject],
  )

  useEffect(() => {
    const socket = getSocket()

    const onReconnect = () => {
      // Send sync request to get all operations since our last seen revision
      socket.emit(ClientEvents.BOARD_SYNC, {
        boardId,
        lastSeenRevision: revision,
      })
    }

    const onSyncResponse = (data: SyncResponse) => {
      applySyncDelta(data.operations)
      setRevision(data.currentRevision)
    }

    socket.on("reconnect", onReconnect)
    // Also listen to connect to handle cases where we disconnected and reconnected
    socket.on("connect", () => {
      // If we already have a revision, we were previously connected. Request sync.
      if (revision > 0) {
        onReconnect()
      }
    })

    socket.on(ServerEvents.SYNC_RESPONSE, onSyncResponse)

    return () => {
      socket.off("reconnect", onReconnect)
      socket.off("connect")
      socket.off(ServerEvents.SYNC_RESPONSE, onSyncResponse)
    }
  }, [boardId, revision, applySyncDelta, setRevision])
}
