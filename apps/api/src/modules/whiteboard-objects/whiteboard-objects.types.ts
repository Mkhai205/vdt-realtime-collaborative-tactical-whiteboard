import type { PrismaClient } from "@rctw/database"

export type WhiteboardTransactionClient = Pick<
  PrismaClient,
  "board" | "boardMember" | "whiteboardObject" | "whiteboardOperation"
>
