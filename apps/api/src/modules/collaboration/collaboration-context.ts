import type { Server } from "socket.io"
import type { CollaborationSocket } from "./gateways/collaboration.gateway"

/**
 * Encapsulates the WebSocket server + client pair passed
 * into every handler method.
 */
export type CollaborationContext = {
  server: Server
  client: CollaborationSocket
}
