import { Injectable } from "@nestjs/common"
import {
  type JwtPayload,
  type ObjectCreatePayload,
  type ObjectUpdatePatch,
  type BoardObjectDto,
  type BoardOperationDto,
  operationTypes,
} from "@rctw/shared-contracts"
import { Prisma, type PrismaClient } from "@rctw/database"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { AppException } from "../../../common/exceptions"
import { toBoardObjectDto } from "./mappers/board-object-response.mapper"

// ─── Return types ──────────────────────────────────────────────────────────────

export type MutationResult = {
  object: BoardObjectDto
  operation: BoardOperationDto
}

export type DeleteResult = {
  objectId: string
  operation: BoardOperationDto
}

export type UndoRedoResult =
  | { kind: "updated"; object: BoardObjectDto; operation: BoardOperationDto }
  | { kind: "deleted"; objectId: string; operation: BoardOperationDto }
  | { kind: "restored"; object: BoardObjectDto; operation: BoardOperationDto }

// ─── Helper types ──────────────────────────────────────────────────────────────

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WhiteboardMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async createObject(
    currentUser: JwtPayload,
    boardId: string,
    payload: ObjectCreatePayload,
    clientOpId: string,
  ): Promise<MutationResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    return this.prisma.$transaction(async (tx) => {
      // Clear redo stack on new action
      await tx.boardOperation.deleteMany({
        where: {
          boardId,
          actorId: currentUser.sub,
          type: operationTypes.OBJECT_RESTORE,
        },
      })

      const revision = await this.incrementRevision(tx, boardId)

      const created = await tx.boardObject.create({
        data: {
          boardId,
          type: payload.type,
          x: payload.x,
          y: payload.y,
          width: payload.width ?? null,
          height: payload.height ?? null,
          points:
            payload.points != null
              ? (payload.points as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          text: payload.text ?? null,
          rotation: payload.rotation,
          style: payload.style as Prisma.InputJsonValue,
          zIndex: payload.zIndex,
          createdById: currentUser.sub,
        },
      })

      const operation = await tx.boardOperation.create({
        data: {
          clientOpId,
          boardId,
          actorId: currentUser.sub,
          objectId: created.id,
          revision,
          type: operationTypes.OBJECT_CREATE,
          baseObjectVersion: null,
          // payload: snapshot của object vừa tạo (để redo)
          payload: this.toJson(toBoardObjectDto(created)),
          // inversePayload: null vì undo của CREATE là delete (không cần data)
          inversePayload: Prisma.DbNull,
        },
      })

      return {
        object: toBoardObjectDto(created),
        operation: this.toOperationDto(operation),
      }
    })
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async updateObject(
    currentUser: JwtPayload,
    boardId: string,
    objectId: string,
    patch: ObjectUpdatePatch,
    clientOpId: string,
    baseVersion: number,
  ): Promise<MutationResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    return this.prisma.$transaction(async (tx) => {
      // Clear redo stack on new action
      await tx.boardOperation.deleteMany({
        where: {
          boardId,
          actorId: currentUser.sub,
          type: operationTypes.OBJECT_RESTORE,
        },
      })

      const existing = await tx.boardObject.findFirst({
        where: { id: objectId, boardId, deletedAt: null },
      })

      if (!existing) throw AppException.objectNotFound()

      // Optimistic concurrency check
      if (existing.version !== baseVersion) {
        throw AppException.objectVersionConflict(
          `Object version mismatch: expected ${baseVersion}, got ${existing.version}.`,
        )
      }

      const revision = await this.incrementRevision(tx, boardId)

      // Chỉ update các field được gửi lên (undefined = giữ nguyên)
      const updated = await tx.boardObject.update({
        where: { id: objectId },
        data: {
          ...(patch.x !== undefined && { x: patch.x }),
          ...(patch.y !== undefined && { y: patch.y }),
          ...(patch.width !== undefined && { width: patch.width }),
          ...(patch.height !== undefined && { height: patch.height }),
          ...(patch.points !== undefined && {
            points: patch.points as Prisma.InputJsonValue,
          }),
          ...(patch.text !== undefined && { text: patch.text }),
          ...(patch.rotation !== undefined && { rotation: patch.rotation }),
          ...(patch.style !== undefined && {
            style: patch.style as Prisma.InputJsonValue,
          }),
          ...(patch.zIndex !== undefined && { zIndex: patch.zIndex }),
          version: { increment: 1 },
          updatedById: currentUser.sub,
        },
      })

      const operation = await tx.boardOperation.create({
        data: {
          clientOpId,
          boardId,
          actorId: currentUser.sub,
          objectId,
          revision,
          type: operationTypes.OBJECT_UPDATE,
          baseObjectVersion: baseVersion,
          // payload: trạng thái mới (để redo)
          payload: this.toJson(patch),
          // inversePayload: trạng thái cũ đầy đủ (để undo restore)
          inversePayload: this.toJson(toBoardObjectDto(existing)),
        },
      })

      return {
        object: toBoardObjectDto(updated),
        operation: this.toOperationDto(operation),
      }
    })
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteObject(
    currentUser: JwtPayload,
    boardId: string,
    objectId: string,
    clientOpId: string,
    baseVersion: number,
  ): Promise<DeleteResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    return this.prisma.$transaction(async (tx) => {
      // Clear redo stack on new action
      await tx.boardOperation.deleteMany({
        where: {
          boardId,
          actorId: currentUser.sub,
          type: operationTypes.OBJECT_RESTORE,
        },
      })

      const existing = await tx.boardObject.findFirst({
        where: { id: objectId, boardId, deletedAt: null },
      })

      if (!existing) throw AppException.objectNotFound()

      // Optimistic concurrency check
      if (existing.version !== baseVersion) {
        throw AppException.objectVersionConflict(
          `Object version mismatch: expected ${baseVersion}, got ${existing.version}.`,
        )
      }

      const revision = await this.incrementRevision(tx, boardId)

      await tx.boardObject.update({
        where: { id: objectId },
        data: {
          deletedAt: new Date(),
          updatedById: currentUser.sub,
        },
      })

      const operation = await tx.boardOperation.create({
        data: {
          clientOpId,
          boardId,
          actorId: currentUser.sub,
          objectId,
          revision,
          type: operationTypes.OBJECT_DELETE,
          baseObjectVersion: baseVersion,
          // payload: thông tin object bị xóa (để audit)
          payload: this.toJson({ objectId }),
          // inversePayload: snapshot đầy đủ của object (để undo restore)
          inversePayload: this.toJson(toBoardObjectDto(existing)),
        },
      })

      return {
        objectId,
        operation: this.toOperationDto(operation),
      }
    })
  }

  // ── Undo ────────────────────────────────────────────────────────────────────

  /**
   * Undo thao tác gần nhất của currentUser trong board (per-user stack).
   *
   * Strategy:
   * - OBJECT_CREATE → soft delete object (undo tạo = xóa)
   * - OBJECT_UPDATE → restore về inversePayload (trạng thái trước khi update)
   * - OBJECT_DELETE → restore object từ inversePayload (xóa deletedAt)
   * - OBJECT_RESTORE → không undo (là kết quả của undo trước đó)
   */
  async undoOperation(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<UndoRedoResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    return this.prisma.$transaction(async (tx) => {
      // Tìm operation gần nhất của user (trừ OBJECT_RESTORE để tránh undo vô tận)
      const lastOp = await tx.boardOperation.findFirst({
        where: {
          boardId,
          actorId: currentUser.sub,
          type: {
            in: [
              operationTypes.OBJECT_CREATE,
              operationTypes.OBJECT_UPDATE,
              operationTypes.OBJECT_DELETE,
            ],
          },
        },
        orderBy: { revision: "desc" },
      })

      if (!lastOp || !lastOp.objectId) {
        throw AppException.validationError("No operations to undo.")
      }

      const revision = await this.incrementRevision(tx, boardId)
      const clientOpId = `undo:${lastOp.id}`

      if (lastOp.type === operationTypes.OBJECT_CREATE) {
        // Undo CREATE → soft delete
        await tx.boardObject.update({
          where: { id: lastOp.objectId },
          data: { deletedAt: new Date(), updatedById: currentUser.sub },
        })

        // Đánh dấu op gốc là đã undo (xóa nó khỏi undo stack)
        await tx.boardOperation.delete({ where: { id: lastOp.id } })

        const undoOp = await tx.boardOperation.create({
          data: {
            clientOpId,
            boardId,
            actorId: currentUser.sub,
            objectId: lastOp.objectId,
            revision,
            type: operationTypes.OBJECT_RESTORE,
            baseObjectVersion: null,
            payload: this.toJson({
              action: "UNDO_CREATE",
              objectId: lastOp.objectId,
            }),
            inversePayload:
              lastOp.payload === null
                ? Prisma.DbNull
                : (lastOp.payload as Prisma.InputJsonValue), // để redo: payload của create gốc
          },
        })

        return {
          kind: "deleted",
          objectId: lastOp.objectId,
          operation: this.toOperationDto(undoOp),
        }
      }

      if (lastOp.type === operationTypes.OBJECT_UPDATE) {
        // Undo UPDATE → restore về snapshot trước (inversePayload)
        if (!lastOp.inversePayload) {
          throw AppException.invalidOperationPayload(
            "Cannot undo: operation has no inverse payload.",
          )
        }

        const prevSnapshot = lastOp.inversePayload as BoardObjectDto
        const restored = await tx.boardObject.update({
          where: { id: lastOp.objectId },
          data: {
            x: prevSnapshot.x,
            y: prevSnapshot.y,
            width: prevSnapshot.width,
            height: prevSnapshot.height,
            points:
              prevSnapshot.points != null
                ? (prevSnapshot.points as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            text: prevSnapshot.text,
            rotation: prevSnapshot.rotation,
            style: prevSnapshot.style as Prisma.InputJsonValue,
            zIndex: prevSnapshot.zIndex,
            version: prevSnapshot.version, // restore về version cũ
            updatedById: currentUser.sub,
          },
        })

        await tx.boardOperation.delete({ where: { id: lastOp.id } })

        const undoOp = await tx.boardOperation.create({
          data: {
            clientOpId,
            boardId,
            actorId: currentUser.sub,
            objectId: lastOp.objectId,
            revision,
            type: operationTypes.OBJECT_RESTORE,
            baseObjectVersion: null,
            payload: this.toJson({ action: "UNDO_UPDATE" }),
            inversePayload:
              lastOp.payload === null
                ? Prisma.DbNull
                : (lastOp.payload as Prisma.InputJsonValue), // để redo: patch của update gốc
          },
        })

        return {
          kind: "updated",
          object: toBoardObjectDto(restored),
          operation: this.toOperationDto(undoOp),
        }
      }

      if (lastOp.type === operationTypes.OBJECT_DELETE) {
        // Undo DELETE → restore object
        if (!lastOp.inversePayload) {
          throw AppException.invalidOperationPayload(
            "Cannot undo: delete operation has no inverse payload.",
          )
        }

        const snapshot = lastOp.inversePayload as BoardObjectDto
        const restored = await tx.boardObject.update({
          where: { id: lastOp.objectId },
          data: {
            deletedAt: null,
            x: snapshot.x,
            y: snapshot.y,
            width: snapshot.width,
            height: snapshot.height,
            points:
              snapshot.points != null
                ? (snapshot.points as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            text: snapshot.text,
            rotation: snapshot.rotation,
            style: snapshot.style as Prisma.InputJsonValue,
            zIndex: snapshot.zIndex,
            version: snapshot.version,
            updatedById: currentUser.sub,
          },
        })

        await tx.boardOperation.delete({ where: { id: lastOp.id } })

        const undoOp = await tx.boardOperation.create({
          data: {
            clientOpId,
            boardId,
            actorId: currentUser.sub,
            objectId: lastOp.objectId,
            revision,
            type: operationTypes.OBJECT_RESTORE,
            baseObjectVersion: null,
            payload: this.toJson({
              action: "UNDO_DELETE",
              objectId: lastOp.objectId,
            }),
            inversePayload: Prisma.DbNull, // redo của undo-delete là delete lại
          },
        })

        return {
          kind: "restored",
          object: toBoardObjectDto(restored),
          operation: this.toOperationDto(undoOp),
        }
      }

      throw AppException.validationError("No undoable operations found.")
    })
  }

  // ── Redo ────────────────────────────────────────────────────────────────────

  /**
   * Redo thao tác undo gần nhất của currentUser.
   *
   * Strategy: Tìm OBJECT_RESTORE op gần nhất của user và apply ngược lại.
   * inversePayload trong OBJECT_RESTORE chứa payload của op gốc.
   */
  async redoOperation(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<UndoRedoResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    return this.prisma.$transaction(async (tx) => {
      const lastRestoreOp = await tx.boardOperation.findFirst({
        where: {
          boardId,
          actorId: currentUser.sub,
          type: operationTypes.OBJECT_RESTORE,
        },
        orderBy: { revision: "desc" },
      })

      if (!lastRestoreOp || !lastRestoreOp.objectId) {
        throw AppException.validationError("No operations to redo.")
      }

      const revision = await this.incrementRevision(tx, boardId)
      const clientOpId = `redo:${lastRestoreOp.id}`
      const action = (lastRestoreOp.payload as { action?: string })?.action

      if (action === "UNDO_CREATE") {
        // Redo của undo-create → re-create (restore deleted object)
        const originalObject = lastRestoreOp.inversePayload as BoardObjectDto

        const restored = await tx.boardObject.update({
          where: { id: lastRestoreOp.objectId },
          data: {
            deletedAt: null,
            x: originalObject.x,
            y: originalObject.y,
            width: originalObject.width,
            height: originalObject.height,
            ...(originalObject.points !== undefined && {
              points:
                originalObject.points != null
                  ? (originalObject.points as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }),
            text: originalObject.text,
            rotation: originalObject.rotation,
            style: originalObject.style as Prisma.InputJsonValue,
            zIndex: originalObject.zIndex,
            version: originalObject.version,
            updatedById: currentUser.sub,
          },
        })

        await tx.boardOperation.delete({ where: { id: lastRestoreOp.id } })

        const redoOp = await tx.boardOperation.create({
          data: {
            clientOpId,
            boardId,
            actorId: currentUser.sub,
            objectId: lastRestoreOp.objectId,
            revision,
            type: operationTypes.OBJECT_CREATE,
            baseObjectVersion: null,
            payload: this.toJson(toBoardObjectDto(restored)),
            inversePayload: Prisma.DbNull,
          },
        })

        return {
          kind: "restored",
          object: toBoardObjectDto(restored),
          operation: this.toOperationDto(redoOp),
        }
      }

      if (action === "UNDO_UPDATE") {
        // Redo của undo-update → re-apply patch gốc
        const patch = lastRestoreOp.inversePayload as ObjectUpdatePatch

        const existing = await tx.boardObject.findFirst({
          where: { id: lastRestoreOp.objectId, boardId, deletedAt: null },
        })
        if (!existing) throw AppException.objectNotFound()

        const reupdated = await tx.boardObject.update({
          where: { id: lastRestoreOp.objectId },
          data: {
            ...(patch.x !== undefined && { x: patch.x }),
            ...(patch.y !== undefined && { y: patch.y }),
            ...(patch.width !== undefined && { width: patch.width }),
            ...(patch.height !== undefined && { height: patch.height }),
            ...(patch.points !== undefined && {
              points:
                patch.points != null
                  ? (patch.points as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }),
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.rotation !== undefined && { rotation: patch.rotation }),
            ...(patch.style !== undefined && {
              style: patch.style as Prisma.InputJsonValue,
            }),
            ...(patch.zIndex !== undefined && { zIndex: patch.zIndex }),
            version: { increment: 1 },
            updatedById: currentUser.sub,
          },
        })

        await tx.boardOperation.delete({ where: { id: lastRestoreOp.id } })

        const redoOp = await tx.boardOperation.create({
          data: {
            clientOpId,
            boardId,
            actorId: currentUser.sub,
            objectId: lastRestoreOp.objectId,
            revision,
            type: operationTypes.OBJECT_UPDATE,
            baseObjectVersion: existing.version,
            payload: this.toJson(patch),
            inversePayload: this.toJson(toBoardObjectDto(existing)),
          },
        })

        return {
          kind: "updated",
          object: toBoardObjectDto(reupdated),
          operation: this.toOperationDto(redoOp),
        }
      }

      if (action === "UNDO_DELETE") {
        // Redo của undo-delete → re-delete
        const existing = await tx.boardObject.findFirst({
          where: { id: lastRestoreOp.objectId, boardId, deletedAt: null },
        })
        if (!existing) throw AppException.objectNotFound()

        await tx.boardObject.update({
          where: { id: lastRestoreOp.objectId },
          data: { deletedAt: new Date(), updatedById: currentUser.sub },
        })

        await tx.boardOperation.delete({ where: { id: lastRestoreOp.id } })

        const redoOp = await tx.boardOperation.create({
          data: {
            clientOpId,
            boardId,
            actorId: currentUser.sub,
            objectId: lastRestoreOp.objectId,
            revision,
            type: operationTypes.OBJECT_DELETE,
            baseObjectVersion: existing.version,
            payload: this.toJson({ objectId: lastRestoreOp.objectId }),
            inversePayload: this.toJson(toBoardObjectDto(existing)),
          },
        })

        return {
          kind: "deleted",
          objectId: lastRestoreOp.objectId,
          operation: this.toOperationDto(redoOp),
        }
      }

      throw AppException.validationError("No redoable operations found.")
    })
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Tăng currentRevision của board trong transaction và trả về revision mới.
   * Đảm bảo mỗi operation có revision duy nhất và monotonically increasing.
   */
  private async incrementRevision(
    tx: TxClient,
    boardId: string,
  ): Promise<number> {
    const updated = await tx.board.update({
      where: { id: boardId },
      data: { currentRevision: { increment: 1 } },
      select: { currentRevision: true },
    })
    return updated.currentRevision
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue
  }

  private toOperationDto(op: {
    id: string
    clientOpId: string
    boardId: string
    revision: number
    actorId: string
    objectId: string | null
    type: string
    baseObjectVersion: number | null
    payload: unknown
    createdAt: Date
  }): BoardOperationDto {
    return {
      id: op.id,
      clientOpId: op.clientOpId,
      boardId: op.boardId,
      revision: op.revision,
      actorId: op.actorId,
      objectId: op.objectId ?? null,
      type: op.type as BoardOperationDto["type"],
      baseObjectVersion: op.baseObjectVersion ?? null,
      payload: op.payload,
      createdAt: op.createdAt.toISOString(),
    }
  }
}
