import { Injectable } from "@nestjs/common"
import {
  objectCreateSocketRequestSchema,
  objectDeleteSocketRequestSchema,
  objectUpdateSocketRequestSchema,
  redoRequestSchema,
  toBoardSocketName,
  undoRequestSchema,
  type OperationAppliedEvent,
  type UserSummary,
} from "@rctw/shared-contracts"
import { z } from "zod"
import { WhiteboardObjectsService } from "../../whiteboard-objects"
import { PresenceService } from "../presence.service"
import { processUndoRedoOperation } from "../realtime-operation-dispatcher"
import type { RealtimeContext } from "../realtime-context"
import {
  operationRejected,
  parseOperationRejectionContext,
  toOperationRejectedEvent,
  toValidationSocketError,
  type OperationRejectionContext,
} from "../realtime-socket-errors"

@Injectable()
export class WhiteboardMutationHandler {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleObjectCreate(
    ctx: RealtimeContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = objectCreateSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, ...request } = parsed.data

    await this.processObjectOperation(
      ctx,
      parsed.data,
      (currentUser) =>
        this.whiteboardObjectsService.createObject(currentUser, boardId, request),
    )
  }

  async handleObjectUpdate(
    ctx: RealtimeContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = objectUpdateSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, objectId, ...request } = parsed.data

    await this.processObjectOperation(
      ctx,
      parsed.data,
      (currentUser) =>
        this.whiteboardObjectsService.updateObject(
          currentUser,
          boardId,
          objectId,
          request,
        ),
    )
  }

  async handleObjectDelete(
    ctx: RealtimeContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = objectDeleteSocketRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, objectId, ...request } = parsed.data

    await this.processObjectOperation(
      ctx,
      parsed.data,
      (currentUser) =>
        this.whiteboardObjectsService.deleteObject(
          currentUser,
          boardId,
          objectId,
          request,
        ),
    )
  }

  async handleUndoRequest(
    ctx: RealtimeContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = undoRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, clientOpId, inverseOperation } = parsed.data

    await this.processObjectOperation(
      ctx,
      parsed.data,
      (currentUser) =>
        processUndoRedoOperation(
          this.whiteboardObjectsService,
          currentUser,
          boardId,
          clientOpId,
          inverseOperation,
        ),
    )
  }

  async handleRedoRequest(
    ctx: RealtimeContext,
    payload: unknown,
  ): Promise<void> {
    const parsed = redoRequestSchema.safeParse(payload)

    if (!parsed.success) {
      this.emitInvalidOperationPayload(ctx.client, payload, parsed.error)
      return
    }

    const { boardId, clientOpId, redoOperation } = parsed.data

    await this.processObjectOperation(
      ctx,
      parsed.data,
      (currentUser) =>
        processUndoRedoOperation(
          this.whiteboardObjectsService,
          currentUser,
          boardId,
          clientOpId,
          redoOperation,
        ),
    )
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async processObjectOperation(
    { server, client }: RealtimeContext,
    context: OperationRejectionContext,
    persistOperation: (
      currentUser: UserSummary,
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
    client: RealtimeContext["client"],
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
    void message
    void error
  }
}
