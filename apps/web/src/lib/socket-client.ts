import type {
  CursorUpdateRequest,
  CursorUpdatedEvent,
  ObjectCreateSocketRequest,
  ObjectDeleteSocketRequest,
  ObjectTransformPreviewRequest,
  ObjectTransformPreviewedEvent,
  ObjectUpdateSocketRequest,
  OperationAppliedEvent,
  OperationRejectedEvent,
  PresenceUpdateEvent,
  RoomJoinRequest,
  RoomLeaveRequest,
  RoomStateEvent,
  SocketErrorEvent,
} from "@rctw/shared-contracts"
import { io, type Socket } from "socket.io-client"
import { getIdentitySocketAuth } from "@/features/identity/auth-token"
import { socketBaseUrl } from "./api-url"

type ServerToClientEvents = {
  "room:state": (event: RoomStateEvent) => void
  "presence:update": (event: PresenceUpdateEvent) => void
  "cursor:updated": (event: CursorUpdatedEvent) => void
  "object:transform-previewed": (
    event: ObjectTransformPreviewedEvent,
  ) => void
  "operation:applied": (event: OperationAppliedEvent) => void
  "operation:rejected": (event: OperationRejectedEvent) => void
  error: (event: SocketErrorEvent) => void
}

type ClientToServerEvents = {
  "room:join": (request: RoomJoinRequest) => void
  "room:leave": (request: RoomLeaveRequest) => void
  "cursor:update": (request: CursorUpdateRequest) => void
  "object:create": (request: ObjectCreateSocketRequest) => void
  "object:update": (request: ObjectUpdateSocketRequest) => void
  "object:delete": (request: ObjectDeleteSocketRequest) => void
  "object:transform-preview": (
    request: ObjectTransformPreviewRequest,
  ) => void
}

export type WhiteboardSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>

export function createWhiteboardSocket(): WhiteboardSocket {
  return io(socketBaseUrl, {
    autoConnect: false,
    auth: getIdentitySocketAuth(),
    withCredentials: true,
  })
}
