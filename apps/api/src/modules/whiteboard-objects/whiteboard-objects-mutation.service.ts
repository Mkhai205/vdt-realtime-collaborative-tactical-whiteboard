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
import { RoomsPermissionService } from "../rooms"
import {
  duplicateOperation,
  objectAlreadyDeleted,
  objectNotFound,
  objectVersionConflict,
  permissionDenied,
  roomNotFound,
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
  roomId: string
  clientOpId: string
  baseObjectVersion?: number
}

@Injectable()
export class WhiteboardObjectsMutationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly roomsPermissionService: RoomsPermissionService,
  ) {}

  async createObject(
    currentUser: UserSummary,
    roomId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateRoom(tx, currentUser.id, roomId)
      await this.assertUniqueClientOpId(tx, roomId, request.clientOpId)

      const object = await tx.whiteboardObject.create({
        data: {
          ...toCreateObjectData(roomId, currentUser.id, request.object),
        },
      })
      const resultingObject = toWhiteboardObject(object)
      const payload = {
        object: resultingObject,
      }
      const operation = await this.createOperation(tx, {
        currentUser,
        roomId,
        clientOpId: request.clientOpId,
        objectId: object.id,
        type: "OBJECT_CREATE",
        payload,
        inversePayload: {
          objectId: object.id,
        },
      })

      return toOperationAppliedEvent({
        operation,
        actor: currentUser,
        payload,
        resultingObject,
      })
    })
  }

  async updateObject(
    currentUser: UserSummary,
    roomId: string,
    objectId: string,
    request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateRoom(tx, currentUser.id, roomId)
      await this.assertUniqueClientOpId(tx, roomId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(
        tx,
        roomId,
        objectId,
      )
      const previousValues = getPreviousValues(currentObject, request.patch)
      const updatedObject = await this.updateObjectConditionally(
        tx,
        roomId,
        objectId,
        request.baseObjectVersion,
        toUpdateObjectData(currentObject, request.patch, currentUser.id),
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
        roomId,
        clientOpId: request.clientOpId,
        objectId,
        type: "OBJECT_UPDATE",
        baseObjectVersion: request.baseObjectVersion,
        payload,
        inversePayload: {
          objectId,
          patch: previousValues,
        },
      })

      return toOperationAppliedEvent({
        operation,
        actor: currentUser,
        payload,
        resultingObject,
      })
    })
  }

  async deleteObject(
    currentUser: UserSummary,
    roomId: string,
    objectId: string,
    request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateRoom(tx, currentUser.id, roomId)
      await this.assertUniqueClientOpId(tx, roomId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(
        tx,
        roomId,
        objectId,
      )
      const previousObject = toWhiteboardObject(currentObject)
      const deletedObject = await this.updateObjectConditionally(
        tx,
        roomId,
        objectId,
        request.baseObjectVersion,
        {
          deletedAt: new Date(),
          updatedById: currentUser.id,
          version: {
            increment: 1,
          },
        },
      )
      const resultingObject = toWhiteboardObject(deletedObject)
      const payload = {
        objectId,
        previousObject,
      }
      const operation = await this.createOperation(tx, {
        currentUser,
        roomId,
        clientOpId: request.clientOpId,
        objectId,
        type: "OBJECT_DELETE",
        baseObjectVersion: request.baseObjectVersion,
        payload,
        inversePayload: {
          objectId,
          restoredObject: previousObject,
        },
      })

      return toOperationAppliedEvent({
        operation,
        actor: currentUser,
        payload,
        resultingObject,
      })
    })
  }

  async restoreObject(
    currentUser: UserSummary,
    roomId: string,
    objectId: string,
    request: ObjectRestoreRequest,
  ): Promise<OperationAppliedEvent> {
    return this.runObjectMutation(async (tx) => {
      await this.assertCanMutateRoom(tx, currentUser.id, roomId)
      await this.assertUniqueClientOpId(tx, roomId, request.clientOpId)

      const currentObject = await this.loadObjectIncludingDeleted(
        tx,
        roomId,
        objectId,
      )

      if (!currentObject.deletedAt) {
        throw objectVersionConflict(
          toWhiteboardObject(currentObject),
          await this.getCurrentRoomRevision(tx, roomId),
        )
      }

      const previousObject = toWhiteboardObject(currentObject)
      const restoredObject = await this.restoreObjectConditionally(
        tx,
        roomId,
        objectId,
        request.baseObjectVersion,
        {
          deletedAt: null,
          updatedById: currentUser.id,
          version: {
            increment: 1,
          },
        },
      )
      const resultingObject = toWhiteboardObject(restoredObject)
      const payload = {
        objectId,
        previousObject,
        resultingObject,
      }
      const operation = await this.createOperation(tx, {
        currentUser,
        roomId,
        clientOpId: request.clientOpId,
        objectId,
        type: "OBJECT_RESTORE",
        baseObjectVersion: request.baseObjectVersion,
        payload,
        inversePayload: {
          objectId,
        },
      })

      return toOperationAppliedEvent({
        operation,
        actor: currentUser,
        payload,
        resultingObject,
      })
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

  private async assertCanMutateRoom(
    tx: WhiteboardTransactionClient,
    userId: string,
    roomId: string,
  ): Promise<void> {
    const room = await tx.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      select: {
        members: {
          where: {
            userId,
            removedAt: null,
          },
          select: {
            role: true,
          },
          take: 1,
        },
      },
    })

    if (!room) {
      throw roomNotFound()
    }

    const role = room.members.at(0)?.role

    if (!role) {
      throw permissionDenied("You must join this room first.")
    }

    if (!this.roomsPermissionService.canEdit(role)) {
      throw permissionDenied("Only room owners and editors can edit this room.")
    }
  }

  private async assertUniqueClientOpId(
    tx: WhiteboardTransactionClient,
    roomId: string,
    clientOpId: string,
  ): Promise<void> {
    const existingOperation = await tx.whiteboardOperation.findUnique({
      where: {
        roomId_clientOpId: {
          roomId,
          clientOpId,
        },
      },
      select: {
        id: true,
      },
    })

    if (existingOperation) {
      throw duplicateOperation()
    }
  }

  private async loadObjectForMutation(
    tx: WhiteboardTransactionClient,
    roomId: string,
    objectId: string,
  ): Promise<WhiteboardObjectRecord> {
    const object = await tx.whiteboardObject.findFirst({
      where: {
        id: objectId,
        roomId,
      },
    })

    if (!object) {
      throw objectNotFound()
    }

    if (object.deletedAt) {
      throw objectAlreadyDeleted()
    }

    return object
  }

  private async loadObjectIncludingDeleted(
    tx: WhiteboardTransactionClient,
    roomId: string,
    objectId: string,
  ): Promise<WhiteboardObjectRecord> {
    const object = await tx.whiteboardObject.findFirst({
      where: {
        id: objectId,
        roomId,
      },
    })

    if (!object) {
      throw objectNotFound()
    }

    return object
  }

  private async updateObjectConditionally(
    tx: WhiteboardTransactionClient,
    roomId: string,
    objectId: string,
    baseObjectVersion: number,
    data: Prisma.WhiteboardObjectUncheckedUpdateManyInput,
  ): Promise<WhiteboardObjectRecord> {
    const result = await tx.whiteboardObject.updateMany({
      where: {
        id: objectId,
        roomId,
        deletedAt: null,
        version: baseObjectVersion,
      },
      data,
    })

    if (result.count === 0) {
      await this.rejectConditionalMutationMiss(tx, roomId, objectId)
    }

    const object = await tx.whiteboardObject.findFirst({
      where: {
        id: objectId,
        roomId,
      },
    })

    if (!object) {
      throw objectNotFound()
    }

    return object
  }

  private async restoreObjectConditionally(
    tx: WhiteboardTransactionClient,
    roomId: string,
    objectId: string,
    baseObjectVersion: number,
    data: Prisma.WhiteboardObjectUncheckedUpdateManyInput,
  ): Promise<WhiteboardObjectRecord> {
    const result = await tx.whiteboardObject.updateMany({
      where: {
        id: objectId,
        roomId,
        deletedAt: {
          not: null,
        },
        version: baseObjectVersion,
      },
      data,
    })

    if (result.count === 0) {
      await this.rejectRestoreConditionalMutationMiss(tx, roomId, objectId)
    }

    const object = await tx.whiteboardObject.findFirst({
      where: {
        id: objectId,
        roomId,
      },
    })

    if (!object) {
      throw objectNotFound()
    }

    return object
  }

  private async rejectConditionalMutationMiss(
    tx: WhiteboardTransactionClient,
    roomId: string,
    objectId: string,
  ): Promise<never> {
    const object = await tx.whiteboardObject.findFirst({
      where: {
        id: objectId,
        roomId,
      },
    })

    if (!object) {
      throw objectNotFound()
    }

    if (object.deletedAt) {
      throw objectAlreadyDeleted()
    }

    throw objectVersionConflict(
      toWhiteboardObject(object),
      await this.getCurrentRoomRevision(tx, roomId),
    )
  }

  private async rejectRestoreConditionalMutationMiss(
    tx: WhiteboardTransactionClient,
    roomId: string,
    objectId: string,
  ): Promise<never> {
    const object = await tx.whiteboardObject.findFirst({
      where: {
        id: objectId,
        roomId,
      },
    })

    if (!object) {
      throw objectNotFound()
    }

    throw objectVersionConflict(
      toWhiteboardObject(object),
      await this.getCurrentRoomRevision(tx, roomId),
    )
  }

  private async getCurrentRoomRevision(
    tx: WhiteboardTransactionClient,
    roomId: string,
  ): Promise<number | undefined> {
    const room = await tx.room.findFirst({
      where: {
        id: roomId,
      },
      select: {
        currentRevision: true,
      },
    })

    return room ? Number(room.currentRevision) : undefined
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
    const room = await tx.room.update({
      where: {
        id: input.roomId,
      },
      data: {
        currentRevision: {
          increment: 1,
        },
      },
      select: {
        currentRevision: true,
      },
    })

    return tx.whiteboardOperation.create({
      data: {
        clientOpId: input.clientOpId,
        roomId: input.roomId,
        actorId: input.currentUser.id,
        objectId: input.objectId,
        revision: room.currentRevision,
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
      return target.includes("roomId") && target.includes("clientOpId")
    }

    return target === "WhiteboardOperation_roomId_clientOpId_key"
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
