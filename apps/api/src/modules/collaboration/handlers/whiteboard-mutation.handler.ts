import { Injectable, Logger } from "@nestjs/common"
import {
  JwtPayload,
  objectCreateSocketRequestSchema,
  objectDeleteSocketRequestSchema,
  objectUpdateSocketRequestSchema,
  redoRequestSchema,
  toBoardSocketName,
  undoRequestSchema,
  type OperationAppliedEvent,
} from "@rctw/shared-contracts"
import { z } from "zod"
import type { CollaborationContext } from "../collaboration-context"
import {
  operationRejected,
  parseOperationRejectionContext,
  toOperationRejectedEvent,
  toValidationSocketError,
  type OperationRejectionContext,
} from "../collaboration-socket-errors"
import { BoardObjectsService } from "../../board/board-objects.service"
import { PresenceService } from "../presence.service"
import { BoardHistoryService } from "../../board/board-history.service"

@Injectable()
export class WhiteboardMutationHandler {
  private readonly logger = new Logger(WhiteboardMutationHandler.name)

  constructor(
    private readonly whiteboardObjectsService: BoardObjectsService,
    private readonly presenceService: PresenceService,
    private readonly historyService: BoardHistoryService,
  ) {}

  async handleObjectCreate(
    ctx: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = objectCreateSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, ...request } = parsed.data

    await this.processObjectOperation(ctx, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.createObject(currentUser, boardId, request),
    )
  }

  async handleObjectUpdate(
    ctx: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = objectUpdateSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, objectId, ...request } = parsed.data

    await this.processObjectOperation(ctx, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.updateObject(
        currentUser,
        boardId,
        objectId,
        request,
      ),
    )
  }

  async handleObjectDelete(
    ctx: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = objectDeleteSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, objectId, ...request } = parsed.data

    await this.processObjectOperation(ctx, parsed.data, (currentUser) =>
      this.whiteboardObjectsService.deleteObject(
        currentUser,
        boardId,
        objectId,
        request,
      ),
    )
  }

  async handleUndoRequest(
    ctx: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = undoRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, clientOpId, inverseOperation } = parsed.data

    await this.processObjectOperation(ctx, parsed.data, (currentUser) =>
      this.historyService.processUndoRedoOperation(
        currentUser,
        boardId,
        clientOpId,
        inverseOperation,
      ),
    )
  }

  async handleRedoRequest(
    ctx: CollaborationContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = redoRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, clientOpId, redoOperation } = parsed.data

    await this.processObjectOperation(ctx, parsed.data, (currentUser) =>
      this.historyService.processUndoRedoOperation(
        currentUser,
        boardId,
        clientOpId,
        redoOperation,
      ),
    )
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async processObjectOperation(
    { server, client }: CollaborationContext,
    context: OperationRejectionContext,
    persistOperation: (
      currentUser: JwtPayload,
    ) => Promise<OperationAppliedEvent>,
  ): Promise<void> {
    try {
      const currentUser = client.data.currentUser!

      if (!this.presenceService.hasSocketInBoard(client.id, context.boardId)) {
        client.emit(
          "operation:rejected",
          operationRejected(context, {
            reason: "USER_NOT_IN_BOARD",
            message: "Join the board before sending object operations.",
          }),
        )
        return
      }

      const operation = await persistOperation(currentUser)

      server
        .to(toBoardSocketName(context.boardId))
        .emit("operation:applied", operation)
    } catch (error) {
      client.emit(
        "operation:rejected",
        toOperationRejectedEvent(error, context, this.logError.bind(this)),
      )
    }
  }

  private emitInvalidOperationPayload(
    client: CollaborationContext["client"],
    payload: unknown,
    error: z.ZodError,
  ): void {
    const context = parseOperationRejectionContext(payload)

    if (!context) {
      client.emit("error", toValidationSocketError(error))
      return
    }

    client.emit(
      "operation:rejected",
      operationRejected(context, {
        reason: "INVALID_OPERATION_PAYLOAD",
        message: "Invalid object operation payload.",
      }),
    )
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(
      message,
      error instanceof Error ? error.stack : String(error),
    )
  }
}
