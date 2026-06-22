import { Injectable } from "@nestjs/common"
import {
  cursorUpdateRequestSchema,
  editingEndRequestSchema,
  editingStartRequestSchema,
  objectTransformPreviewRequestSchema,
  selectionUpdateRequestSchema,
  toBoardSocketName,
  type BoardRole,
  type CursorUpdatedEvent,
  type ObjectEditingEvent,
} from "@rctw/shared-contracts"
import { Logger } from "@nestjs/common"
import type { CollaborationContext } from "../collaboration-context"
import {
  toSocketError,
  toValidationSocketError,
} from "../collaboration-socket-errors"
import { PresenceService } from "../presence.service"

@Injectable()
export class CollaborationHandler {
  private readonly logger = new Logger(CollaborationHandler.name)

  constructor(private readonly presenceService: PresenceService) {}

  handleEditingStart(ctx: CollaborationContext, payload: unknown): void {
    const parsed = editingStartRequestSchema.safeParse(payload)

    if (!parsed.success) {
      ctx.client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = ctx.client.data.currentUser!
      const { boardId, objectId } = parsed.data

      if (
        !this.requireEditableRole(ctx, boardId, {
          notInBoard: "Join the board before announcing editing state.",
          permissionDenied:
            "Only board owners and editors can announce editing state.",
        })
      ) {
        return
      }

      this.presenceService.startEditing({
        socketId: ctx.client.id,
        boardId,
        objectId,
      })
      this.emitEditingEvent(ctx.server, {
        boardId,
        objectId,
        user: currentUser,
        status: "STARTED",
        exceptSocketId: ctx.client.id,
      })
    } catch (error) {
      ctx.client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  handleEditingEnd(ctx: CollaborationContext, payload: unknown): void {
    const parsed = editingEndRequestSchema.safeParse(payload)

    if (!parsed.success) {
      ctx.client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = ctx.client.data.currentUser!
      const { boardId, objectId } = parsed.data

      if (
        !this.requireEditableRole(ctx, boardId, {
          notInBoard: "Join the board before announcing editing state.",
          permissionDenied:
            "Only board owners and editors can announce editing state.",
        })
      ) {
        return
      }

      this.presenceService.endEditing({
        socketId: ctx.client.id,
        boardId,
        objectId,
      })
      this.emitEditingEvent(ctx.server, {
        boardId,
        objectId,
        user: currentUser,
        status: "ENDED",
        exceptSocketId: ctx.client.id,
      })
    } catch (error) {
      ctx.client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  handleCursorUpdate(ctx: CollaborationContext, payload: unknown): void {
    const parsed = cursorUpdateRequestSchema.safeParse(payload)

    if (!parsed.success) {
      ctx.client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = ctx.client.data.currentUser!
      const { boardId } = parsed.data

      if (!this.presenceService.hasSocketInBoard(ctx.client.id, boardId)) {
        ctx.client.emit("error", {
          code: "USER_NOT_IN_BOARD",
          message: "Join the board before sending cursor updates.",
        })
        return
      }

      const event: CursorUpdatedEvent = {
        ...parsed.data,
        user: currentUser,
        timestamp: new Date().toISOString(),
      }

      ctx.server
        .to(toBoardSocketName(boardId))
        .except(ctx.client.id)
        .emit("cursor:updated", event)
    } catch (error) {
      ctx.client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  handleSelectionUpdate(ctx: CollaborationContext, payload: unknown): void {
    const parsed = selectionUpdateRequestSchema.safeParse(payload)

    if (!parsed.success) {
      ctx.client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      if (!ctx.client.data.currentUser) return

      const { boardId, selectedObjectId } = parsed.data
      const onlineUsers = this.presenceService.updateSelectedObject({
        socketId: ctx.client.id,
        boardId,
        selectedObjectId,
      })

      if (!onlineUsers) {
        ctx.client.emit("error", {
          code: "USER_NOT_IN_BOARD",
          message: "Join the board before sending selection updates.",
        })
        return
      }

      ctx.server.to(toBoardSocketName(boardId)).emit("presence:update", {
        boardId,
        onlineUsers,
      })
    } catch (error) {
      ctx.client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  handleTransformPreview(ctx: CollaborationContext, payload: unknown): void {
    const parsed = objectTransformPreviewRequestSchema.safeParse(payload)

    if (!parsed.success) {
      ctx.client.emit("error", toValidationSocketError(parsed.error))
      return
    }

    try {
      const currentUser = ctx.client.data.currentUser!
      const { boardId, objectId, preview } = parsed.data

      if (
        !this.requireEditableRole(ctx, boardId, {
          notInBoard: "Join the board before sending transform previews.",
          permissionDenied:
            "Only board owners and editors can preview transforms.",
        })
      ) {
        return
      }

      ctx.server
        .to(toBoardSocketName(boardId))
        .except(ctx.client.id)
        .emit("object:transform-previewed", {
          boardId,
          objectId,
          user: currentUser,
          preview,
          timestamp: new Date().toISOString(),
        })
    } catch (error) {
      ctx.client.emit("error", toSocketError(error, this.logError.bind(this)))
    }
  }

  // ── Editing event emitter ──────────────────────────────────────────────

  emitEditingEvent(
    server: import("socket.io").Server,
    input: Omit<ObjectEditingEvent, "timestamp"> & { exceptSocketId?: string },
  ): void {
    const { exceptSocketId, ...eventInput } = input
    const event: ObjectEditingEvent = {
      ...eventInput,
      timestamp: new Date().toISOString(),
    }
    const emitter = server.to(toBoardSocketName(input.boardId))

    if (exceptSocketId) {
      emitter.except(exceptSocketId).emit("object:editing", event)
    } else {
      emitter.emit("object:editing", event)
    }
  }

  // ── Private guards ─────────────────────────────────────────────────────

  private requireEditableRole(
    { client }: CollaborationContext,
    boardId: string,
    messages: { notInBoard: string; permissionDenied: string },
  ): BoardRole | null {
    const role = this.presenceService.getSocketBoardRole(client.id, boardId)

    if (!role) {
      client.emit("error", {
        code: "USER_NOT_IN_BOARD",
        message: messages.notInBoard,
      })
      return null
    }

    if (role !== "OWNER" && role !== "EDITOR") {
      client.emit("error", {
        code: "PERMISSION_DENIED",
        message: messages.permissionDenied,
      })
      return null
    }

    return role
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(
      message,
      error instanceof Error ? error.stack : String(error),
    )
  }
}
