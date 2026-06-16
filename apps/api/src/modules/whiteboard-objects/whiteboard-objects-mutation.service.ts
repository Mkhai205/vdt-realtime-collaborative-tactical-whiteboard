import { Injectable } from "@nestjs/common"
import { Prisma } from "@rctw/database"
import {
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectRestoreRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { BoardPermissionService } from "../permission/services/board-permission.service"
import {
  boardNotFound,
  duplicateOperation,
  objectAlreadyDeleted,
  objectNotFound,
  objectVersionConflict,
  permissionDenied,
} from "./whiteboard-object-errors"
import {
  getPreviousValues,
  toCreateObjectData,
  toJsonValue,
  toUpdateObjectData,
} from "./whiteboard-object-mutation.mapper"
import {
  toOperationAppliedEvent,
  toWhiteboardObject,
  type WhiteboardObjectRecord,
} from "./whiteboard-object-response.mapper"
import type { WhiteboardTransactionClient } from "./whiteboard-objects.types"

type MutationContext = {
  currentUser: UserSummary
  boardId: string
  clientOpId: string
  baseObjectVersion?: number
}

@Injectable()
export class WhiteboardObjectsMutationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  async createObject(
    currentUser: UserSummary,
    boardId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.id, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const object = await tx.whiteboardObject.create({
        data: {
          ...toCreateObjectData(boardId, currentUser.id, request.object),
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

      return toOperationAppliedEvent({ operation, actor: currentUser, payload, resultingObject })
    })
  }

  async updateObject(
    currentUser: UserSummary,
    boardId: string,
    objectId: string,
    request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.id, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(tx, boardId, objectId)
      const previousValues = getPreviousValues(currentObject, request.patch)
      const updatedObject = await this.updateObjectConditionally(
        tx, boardId, objectId, request.baseObjectVersion,
        toUpdateObjectData(currentObject, request.patch, currentUser.id),
      )
      const resultingObject = toWhiteboardObject(updatedObject)
      const payload = { objectId, patch: request.patch, previousValues, resultingObject }
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

      return toOperationAppliedEvent({ operation, actor: currentUser, payload, resultingObject })
    })
  }

  async deleteObject(
    currentUser: UserSummary,
    boardId: string,
    objectId: string,
    request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.id, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(tx, boardId, objectId)
      const previousObject = toWhiteboardObject(currentObject)
      const deletedObject = await this.updateObjectConditionally(
        tx, boardId, objectId, request.baseObjectVersion,
        { deletedAt: new Date(), updatedById: currentUser.id, version: { increment: 1 } },
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

      return toOperationAppliedEvent({ operation, actor: currentUser, payload, resultingObject })
    })
  }

  async restoreObject(
    currentUser: UserSummary,
    boardId: string,
    objectId: string,
    request: ObjectRestoreRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateBoard(tx, currentUser.id, boardId)
      await this.assertUniqueClientOpId(tx, boardId, request.clientOpId)

      const currentObject = await this.loadObjectIncludingDeleted(tx, boardId, objectId)

      if (!currentObject.deletedAt) {
        throw objectVersionConflict(
          toWhiteboardObject(currentObject),
          await this.getCurrentBoardRevision(tx, boardId),
        )
      }

      const previousObject = toWhiteboardObject(currentObject)
      const restoredObject = await this.restoreObjectConditionally(
        tx, boardId, objectId, request.baseObjectVersion,
        { deletedAt: null, updatedById: currentUser.id, version: { increment: 1 } },
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

      return toOperationAppliedEvent({ operation, actor: currentUser, payload, resultingObject })
    })
  }

  private async runObjectMutation<T>(
    mutation: (tx: WhiteboardTransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prismaService.$transaction((tx) => mutation(tx))
    } catch (error) {
      if (this.isDuplicateClientOperationConstraintError(error)) {
        throw duplicateOperation()
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
      where: { id: boardId, deletedAt: null },
      select: {
        members: {
          where: { userId, removedAt: null },
          select: { role: true },
          take: 1,
        },
      },
    })

    if (!board) {
      throw boardNotFound()
    }

    const role = board.members.at(0)?.role

    if (!role) {
      throw permissionDenied("You must join this board first.")
    }

    if (!this.boardPermissionService.canEdit(role)) {
      throw permissionDenied("Only board owners and editors can edit this board.")
    }
  }

  private async assertUniqueClientOpId(
    tx: WhiteboardTransactionClient,
    boardId: string,
    clientOpId: string,
  ): Promise<void> {
    const existingOperation = await tx.whiteboardOperation.findUnique({
      where: {
        boardId_clientOpId: { boardId, clientOpId },
      },
      select: { id: true },
    })

    if (existingOperation) {
      throw duplicateOperation()
    }
  }

  private async loadObjectForMutation(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<WhiteboardObjectRecord> {
    const object = await tx.whiteboardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw objectNotFound()
    if (object.deletedAt) throw objectAlreadyDeleted()

    return object
  }

  private async loadObjectIncludingDeleted(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<WhiteboardObjectRecord> {
    const object = await tx.whiteboardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw objectNotFound()

    return object
  }

  private async updateObjectConditionally(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
    baseObjectVersion: number,
    data: Prisma.WhiteboardObjectUncheckedUpdateManyInput,
  ): Promise<WhiteboardObjectRecord> {
    const result = await tx.whiteboardObject.updateMany({
      where: { id: objectId, boardId, deletedAt: null, version: baseObjectVersion },
      data,
    })

    if (result.count === 0) {
      await this.rejectConditionalMutationMiss(tx, boardId, objectId)
    }

    const object = await tx.whiteboardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw objectNotFound()

    return object
  }

  private async restoreObjectConditionally(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
    baseObjectVersion: number,
    data: Prisma.WhiteboardObjectUncheckedUpdateManyInput,
  ): Promise<WhiteboardObjectRecord> {
    const result = await tx.whiteboardObject.updateMany({
      where: {
        id: objectId,
        boardId,
        deletedAt: { not: null },
        version: baseObjectVersion,
      },
      data,
    })

    if (result.count === 0) {
      await this.rejectRestoreConditionalMutationMiss(tx, boardId, objectId)
    }

    const object = await tx.whiteboardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw objectNotFound()

    return object
  }

  private async rejectConditionalMutationMiss(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<never> {
    const object = await tx.whiteboardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw objectNotFound()
    if (object.deletedAt) throw objectAlreadyDeleted()

    throw objectVersionConflict(
      toWhiteboardObject(object),
      await this.getCurrentBoardRevision(tx, boardId),
    )
  }

  private async rejectRestoreConditionalMutationMiss(
    tx: WhiteboardTransactionClient,
    boardId: string,
    objectId: string,
  ): Promise<never> {
    const object = await tx.whiteboardObject.findFirst({
      where: { id: objectId, boardId },
    })

    if (!object) throw objectNotFound()

    throw objectVersionConflict(
      toWhiteboardObject(object),
      await this.getCurrentBoardRevision(tx, boardId),
    )
  }

  private async getCurrentBoardRevision(
    tx: WhiteboardTransactionClient,
    boardId: string,
  ): Promise<number | undefined> {
    const board = await tx.board.findFirst({
      where: { id: boardId },
      select: { currentRevision: true },
    })

    return board ? Number(board.currentRevision) : undefined
  }

  private async createOperation(
    tx: WhiteboardTransactionClient,
    input: MutationContext & {
      objectId: string
      type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE" | "OBJECT_RESTORE"
      payload: unknown
      inversePayload?: unknown
    },
  ) {
    const board = await tx.board.update({
      where: { id: input.boardId },
      data: { currentRevision: { increment: 1 } },
      select: { currentRevision: true },
    })

    return tx.whiteboardOperation.create({
      data: {
        clientOpId: input.clientOpId,
        boardId: input.boardId,
        actorId: input.currentUser.id,
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

  private isDuplicateClientOperationConstraintError(error: unknown): boolean {
    if (!isPrismaUniqueConstraintError(error)) {
      return false
    }

    const target = error.meta?.target

    if (Array.isArray(target)) {
      return target.includes("boardId") && target.includes("clientOpId")
    }

    return target === "WhiteboardOperation_boardId_clientOpId_key"
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
