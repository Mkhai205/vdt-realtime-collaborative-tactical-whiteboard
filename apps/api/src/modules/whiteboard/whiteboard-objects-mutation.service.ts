import { Injectable, Logger } from "@nestjs/common"
import { Prisma, PrismaClient } from "@rctw/database"
import {
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectRestoreRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
  type JwtPayload,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { BoardPermissionService } from "../board/board-permission.service"
import { WhiteboardSnapshotsService } from "./whiteboard-snapshots.service"
import {
  getPreviousValues,
  toCreateObjectData,
  toJsonValue,
  toUpdateObjectData,
} from "./mappers/board-object-mutation.mapper"
import {
  toOperationAppliedEvent,
  toWhiteboardObject,
  type WhiteboardObjectRecord,
} from "./mappers/board-object-response.mapper"
import { AppException } from "../../common/exceptions"

type WhiteboardTransactionClient = Pick<
  PrismaClient,
  "board" | "boardMember" | "boardObject" | "boardOperation"
>

type MutationContext = {
  currentUser: JwtPayload
  boardId: string
  clientOpId: string
  baseObjectVersion?: number
}

@Injectable()
export class WhiteboardObjectsMutationService {
  private readonly logger = new Logger(WhiteboardObjectsMutationService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
    private readonly whiteboardSnapshotsService: WhiteboardSnapshotsService,
  ) {}

  async createObject(
    currentUser: JwtPayload,
    boardId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(boardId, async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.sub, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const object = await tx.boardObject.create({
        data: {
          ...toCreateObjectData(boardId, currentUser.sub, request.object),
        },
      })
      const resultingObject = toWhiteboardObject(object)
      const payload = { object: resultingObject }
      const operation = await this.createOperation(tx, {
        currentUser,
        boardId,
        clientOpId: request.clientOpId,
        objectId: object.id,
        type: "OBJECT_CREATE",
        payload,
        inversePayload: { objectId: object.id },
      })

      return toOperationAppliedEvent({
        operation,
        actor: this.toUserSummary(currentUser),
        payload,
        resultingObject,
      })
    })
  }

  async updateObject(
    currentUser: JwtPayload,
    boardId: string,
    objectId: string,
    request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(boardId, async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.sub, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(
        tx,
        boardId,
        objectId,
      )
      const previousValues = getPreviousValues(currentObject, request.patch)
      const updatedObject = await this.updateObjectConditionally(
        tx,
        boardId,
        objectId,
        request.baseObjectVersion,
        toUpdateObjectData(currentObject, request.patch, currentUser.sub),
      )
      const resultingObject = toWhiteboardObject(updatedObject)
      const payload = {
        objectId,
        patch: request.patch,
        previousValues,
        resultingObject,
      }
      const operation = await this.createOperation(tx, {
        currentUser,
        boardId,
        clientOpId: request.clientOpId,
        objectId,
        type: "OBJECT_UPDATE",
        baseObjectVersion: request.baseObjectVersion,
        payload,
        inversePayload: { objectId, patch: previousValues },
      })

      return toOperationAppliedEvent({
        operation,
        actor: this.toUserSummary(currentUser),
        payload,
        resultingObject,
      })
    })
  }

  async deleteObject(
    currentUser: JwtPayload,
    boardId: string,
    objectId: string,
    request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(boardId, async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.sub, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(
        tx,
        boardId,
        objectId,
      )
      const previousObject = toWhiteboardObject(currentObject)
      const deletedObject = await this.updateObjectConditionally(
        tx,
        boardId,
        objectId,
        request.baseObjectVersion,
        {
          deletedAt: new Date(),
          updatedById: currentUser.sub,
          version: { increment: 1 },
        },
      )
      const resultingObject = toWhiteboardObject(deletedObject)
      const payload = { objectId, previousObject }
      const operation = await this.createOperation(tx, {
        currentUser,
        boardId,
        clientOpId: request.clientOpId,
        objectId,
        type: "OBJECT_DELETE",
        baseObjectVersion: request.baseObjectVersion,
        payload,
        inversePayload: { objectId, restoredObject: previousObject },
      })

      return toOperationAppliedEvent({
        operation,
        actor: this.toUserSummary(currentUser),
        payload,
        resultingObject,
      })
    })
  }

  async restoreObject(
    currentUser: JwtPayload,
    boardId: string,
    objectId: string,
    request: ObjectRestoreRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(boardId, async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.sub, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const currentObject = await this.loadObjectIncludingDeleted(
        tx,
        boardId,
        objectId,
      )

      if (!currentObject.deletedAt) {
        throw AppException.objectVersionConflict()
      }

      const previousObject = toWhiteboardObject(currentObject)
      const restoredObject = await this.restoreObjectConditionally(
        tx,
        boardId,
        objectId,
        request.baseObjectVersion,
        {
          deletedAt: null,
          updatedById: currentUser.sub,
          version: { increment: 1 },
        },
      )
      const resultingObject = toWhiteboardObject(restoredObject)
      const payload = { objectId, previousObject, resultingObject }
      const operation = await this.createOperation(tx, {
        currentUser,
        boardId,
        clientOpId: request.clientOpId,
        objectId,
        type: "OBJECT_RESTORE",
        baseObjectVersion: request.baseObjectVersion,
        payload,
        inversePayload: { objectId },
      })

      return toOperationAppliedEvent({
        operation,
        actor: this.toUserSummary(currentUser),
        payload,
        resultingObject,
      })
    })
  }

  private async runObjectMutation<T>(
    boardId: string,
    mutation: (tx: WhiteboardTransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await this.prismaService.$transaction((tx) => mutation(tx))
      const resultObj = result as any

      if (
        resultObj &&
        typeof resultObj === "object" &&
        typeof resultObj.revision === "number"
      ) {
        if (resultObj.revision % 100 === 0) {
          this.whiteboardSnapshotsService
            .createSnapshot(boardId)
            .catch((err) => {
              this.logger.error(
                `Failed to create snapshot for board ${boardId} at revision ${resultObj.revision}:`,
                err instanceof Error ? err.stack : String(err),
              )
            })
        }
      }

      return result
    } catch (error) {
      if (this.isDuplicateClientOperationConstraintError(error)) {
        throw AppException.duplicateOperation()
      }
      throw error
    }
  }

  private async assertCanMutateBoard(
    tx: WhiteboardTransactionClient,
    userId: string,
    boardId: string,
  ): Promise<void> {
    const board = await tx.board.findFirst({
      where: { id: boardId },
      select: {
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    })

    if (!board) {
      throw AppException.boardNotFound()
    }

    const role = board.members.at(0)?.role

    if (!role) {
      throw AppException.permissionDenied("You must join this board first.")
    }

    if (!this.boardPermissionService.canEdit(role)) {
      throw AppException.permissionDenied(
        "Only board owners and editors can edit this board.",
      )
    }
  }

  private async assertUniqueClientOpId(
    tx: WhiteboardTransactionClient,
    boardId: string,
    clientOpId: string,
  ): Promise<void> {
    const existingOperation = await tx.boardOperation.findUnique({
      where: {
        boardId_clientOpId: { boardId, clientOpId },
      },
      select: { id: true },
    })

    if (existingOperation) {
      throw AppException.duplicateOperation()
    }
  }

  private async loadObjectForMutation(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<WhiteboardObjectRecord> {
    const object = await tx.boardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw AppException.objectNotFound()
    if (object.deletedAt) throw AppException.objectAlreadyDeleted()

    return object
  }

  private async loadObjectIncludingDeleted(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<WhiteboardObjectRecord> {
    const object = await tx.boardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw AppException.objectNotFound()

    return object
  }

  private async updateObjectConditionally(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
    baseObjectVersion: number | undefined,
    data: Prisma.BoardObjectUncheckedUpdateManyInput,
  ): Promise<WhiteboardObjectRecord> {
    const versionFilter =
      baseObjectVersion !== undefined ? { version: baseObjectVersion } : {}

    const result = await tx.boardObject.updateMany({
      where: {
        id: objectId,
        boardId,
        deletedAt: null,
        ...versionFilter,
      },
      data,
    })

    if (result.count === 0) {
      await this.rejectConditionalMutationMiss(tx, boardId, objectId)
    }

    const object = await tx.boardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw AppException.objectNotFound()

    return object
  }

  private async restoreObjectConditionally(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
    baseObjectVersion: number | undefined,
    data: Prisma.BoardObjectUncheckedUpdateManyInput,
  ): Promise<WhiteboardObjectRecord> {
    const versionFilter =
      baseObjectVersion !== undefined ? { version: baseObjectVersion } : {}

    const result = await tx.boardObject.updateMany({
      where: {
        id: objectId,
        boardId,
        deletedAt: { not: null },
        ...versionFilter,
      },
      data,
    })

    if (result.count === 0) {
      await this.rejectRestoreConditionalMutationMiss(tx, boardId, objectId)
    }

    const object = await tx.boardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw AppException.objectNotFound()

    return object
  }

  private async rejectConditionalMutationMiss(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<never> {
    const object = await tx.boardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw AppException.objectNotFound()
    if (object.deletedAt) throw AppException.objectAlreadyDeleted()

    throw AppException.objectVersionConflict()
  }

  private async rejectRestoreConditionalMutationMiss(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<never> {
    const object = await tx.boardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw AppException.objectNotFound()

    throw AppException.objectVersionConflict()
  }

  private async getCurrentBoardRevision(
    tx: WhiteboardTransactionClient,
    boardId: string,
  ): Promise<number | undefined> {
    const board = await tx.board.findFirst({
      where: { id: boardId },
      select: { currentRevision: true },
    })

    return board ? board.currentRevision : undefined
  }

  private async createOperation(
    tx: WhiteboardTransactionClient,
    input: MutationContext & {
      objectId: string
      type:
        | "OBJECT_CREATE"
        | "OBJECT_UPDATE"
        | "OBJECT_DELETE"
        | "OBJECT_RESTORE"
      payload: unknown
      inversePayload?: unknown
    },
  ) {
    const board = await tx.board.update({
      where: { id: input.boardId },
      data: { currentRevision: { increment: 1 } },
      select: { currentRevision: true },
    })

    return tx.boardOperation.create({
      data: {
        clientOpId: input.clientOpId,
        boardId: input.boardId,
        actorId: input.currentUser.sub,
        objectId: input.objectId,
        revision: board.currentRevision,
        type: input.type,
        baseObjectVersion: input.baseObjectVersion ?? null,
        payload: toJsonValue(input.payload),
        inversePayload:
          input.inversePayload === undefined
            ? Prisma.DbNull
            : toJsonValue(input.inversePayload),
      },
    })
  }

  private toUserSummary(currentUser: JwtPayload): UserSummary {
    return {
      id: currentUser.sub,
      name: currentUser.name,
      email: currentUser.email,
    }
  }

  private isDuplicateClientOperationConstraintError(error: unknown): boolean {
    if (!isPrismaUniqueConstraintError(error)) {
      return false
    }

    const target = error.meta?.target

    if (Array.isArray(target)) {
      return target.includes("boardId") && target.includes("clientOpId")
    }

    return target === "BoardOperation_boardId_clientOpId_key"
  }
}

function isPrismaUniqueConstraintError(
  error: unknown,
): error is { code: "P2002"; meta?: { target?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}
