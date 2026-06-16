import type { Server } from "socket.io"
import type { RealtimeSocket } from "./realtime.gateway"

/**
 * Encapsulates the WebSocket server + client pair passed
 * into every handler method.
 */
export type RealtimeContext = {
  server: Server
  client: RealtimeSocket
}
