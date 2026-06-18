import type {
  CursorUpdateRequest,
  CursorUpdatedEvent,
  EditingEndRequest,
  EditingStartRequest,
  ObjectEditingEvent,
  ObjectCreateSocketRequest,
  ObjectDeleteSocketRequest,
  ObjectTransformPreviewRequest,
  ObjectTransformPreviewedEvent,
  ObjectUpdateSocketRequest,
  OperationAppliedEvent,
  OperationRejectedEvent,
  PresenceUpdateEvent,
  RedoRequest,
  BoardJoinRequest,
  BoardLeaveRequest,
  SelectionUpdateRequest,
  BoardStateEvent,
  SocketErrorEvent,
  SyncRequest,
  SyncResponse,
  UndoRequest,
} from "@rctw/shared-contracts"
import { io, type Socket } from "socket.io-client"
import { socketBaseUrl } from "./api-url"
import { useAuthStore } from "@/stores/auth-store"

type ServerToClientEvents = {
  "board:state": (event: BoardStateEvent) => void
  "presence:update": (event: PresenceUpdateEvent) => void
  "cursor:updated": (event: CursorUpdatedEvent) => void
  "object:editing": (event: ObjectEditingEvent) => void
  "object:transform-previewed": (event: ObjectTransformPreviewedEvent) => void
  "operation:applied": (event: OperationAppliedEvent) => void
  "operation:rejected": (event: OperationRejectedEvent) => void
  "sync:response": (event: SyncResponse) => void
  error: (event: SocketErrorEvent) => void
}

type ClientToServerEvents = {
  "board:join": (request: BoardJoinRequest) => void
  "board:leave": (request: BoardLeaveRequest) => void
  "sync:request": (request: SyncRequest) => void
  "selection:update": (request: SelectionUpdateRequest) => void
  "cursor:update": (request: CursorUpdateRequest) => void
  "editing:start": (request: EditingStartRequest) => void
  "editing:end": (request: EditingEndRequest) => void
  "object:create": (request: ObjectCreateSocketRequest) => void
  "object:update": (request: ObjectUpdateSocketRequest) => void
  "object:delete": (request: ObjectDeleteSocketRequest) => void
  "undo:request": (request: UndoRequest) => void
  "redo:request": (request: RedoRequest) => void
  "object:transform-preview": (request: ObjectTransformPreviewRequest) => void
}

export type WhiteboardSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>

export function createWhiteboardSocket(): WhiteboardSocket {
  const token = useAuthStore.getState().accessToken
  return io(socketBaseUrl, {
    autoConnect: false,
    auth: token ? { token } : {},
    withCredentials: true,
  })
}
