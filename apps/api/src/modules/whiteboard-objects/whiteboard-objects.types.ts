import type { PrismaClient } from "@rctw/database"

export type WhiteboardTransactionClient = Pick<
  PrismaClient,
  "room" | "roomMember" | "whiteboardObject" | "whiteboardOperation"
>
