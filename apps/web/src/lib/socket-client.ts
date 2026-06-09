import type {
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
  error: (event: SocketErrorEvent) => void
}

type ClientToServerEvents = {
  "room:join": (request: RoomJoinRequest) => void
  "room:leave": (request: RoomLeaveRequest) => void
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
