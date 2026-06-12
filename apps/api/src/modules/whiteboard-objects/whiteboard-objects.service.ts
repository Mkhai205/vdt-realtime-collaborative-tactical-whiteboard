import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Prisma, type PrismaClient } from "@rctw/database"
import {
  whiteboardObjectSchema,
  type GetRoomObjectsResponse,
  type GetRoomOperationsQuery,
  type GetRoomOperationsResponse,
  type ObjectCreateInput,
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectMutablePatch,
  type ObjectRestoreRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
  type SyncOperationsResponse,
  type UserSummary,
  type WhiteboardObject,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { RoomsPermissionService } from "../rooms"
import {
  toOperationAppliedEvent,
  toOperationSummary,
  toShapeStyle,
  toWhiteboardObject,
  type WhiteboardObjectRecord,
} from "./whiteboard-object-response.mapper"

type WhiteboardTransactionClient = Pick<
  PrismaClient,
  "room" | "roomMember" | "whiteboardObject" | "whiteboardOperation"
>

type MutationContext = {
  currentUser: UserSummary
  roomId: string
  clientOpId: string
  baseObjectVersion?: number
}

@Injectable()
export class WhiteboardObjectsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly roomsPermissionService: RoomsPermissionService,
  ) {}

  async getRoomObjects(
    currentUser: UserSummary,
    roomId: string,
  ): Promise<GetRoomObjectsResponse> {
    await this.roomsPermissionService.assertRoomMember(currentUser.id, roomId)

    const room = await this.prismaService.client.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      select: {
        currentRevision: true,
      },
    })

    if (!room) {
      throw this.roomNotFound()
    }

    const objects = await this.prismaService.client.whiteboardObject.findMany({
      where: {
        roomId,
        deletedAt: null,
      },
      orderBy: [
        {
          zIndex: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    })

    return {
      roomId,
      currentRevision: Number(room.currentRevision),
      objects: objects.map(toWhiteboardObject),
    }
  }

  async getRoomOperations(
    currentUser: UserSummary,
    roomId: string,
    query: Partial<GetRoomOperationsQuery> = {},
  ): Promise<GetRoomOperationsResponse> {
    await this.roomsPermissionService.assertRoomMember(currentUser.id, roomId)

    const operations =
      await this.prismaService.client.whiteboardOperation.findMany({
        where: {
          roomId,
        },
        orderBy: {
          revision: "desc",
        },
        take: this.normalizeOperationLimit(query.limit),
        select: {
          id: true,
          clientOpId: true,
          roomId: true,
          objectId: true,
          revision: true,
          type: true,
          payload: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              avatarColor: true,
            },
          },
          object: {
            select: {
              type: true,
            },
          },
        },
      })

    return {
      roomId,
      operations: operations.map(toOperationSummary),
    }
  }

  async getRoomOperationReplay(
    currentUser: UserSummary,
    roomId: string,
    lastSeenRevision: number,
  ): Promise<SyncOperationsResponse> {
    await this.roomsPermissionService.assertRoomMember(currentUser.id, roomId)

    const room = await this.prismaService.client.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      select: {
        currentRevision: true,
      },
    })

    if (!room) {
      throw this.roomNotFound()
    }

    const currentRevision = Number(room.currentRevision)

    if (lastSeenRevision >= currentRevision) {
      return {
        mode: "OPERATIONS",
        roomId,
        fromRevision: lastSeenRevision,
        toRevision: currentRevision,
        operations: [],
      }
    }

    const operations =
      await this.prismaService.client.whiteboardOperation.findMany({
        where: {
          roomId,
          revision: {
            gt: BigInt(lastSeenRevision),
            lte: room.currentRevision,
          },
        },
        orderBy: {
          revision: "asc",
        },
        select: {
          id: true,
          clientOpId: true,
          roomId: true,
          objectId: true,
          revision: true,
          type: true,
          payload: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              avatarColor: true,
            },
          },
        },
      })

    return {
      mode: "OPERATIONS",
      roomId,
      fromRevision: lastSeenRevision,
      toRevision: currentRevision,
      operations: operations.map((operation) =>
        this.toOperationReplayEvent(operation),
      ),
    }
  }

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
          ...this.toCreateObjectData(roomId, currentUser.id, request.object),
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
      const previousValues = this.getPreviousValues(
        currentObject,
        request.patch,
      )
      const updatedObject = await this.updateObjectConditionally(
        tx,
        roomId,
        objectId,
        request.baseObjectVersion,
        this.toUpdateObjectData(currentObject, request.patch, currentUser.id),
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
        throw this.objectVersionConflict(
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
      return await this.prismaService.client.$transaction((tx) => mutation(tx))
    } catch (error) {
      if (this.isDuplicateClientOperationConstraintError(error)) {
        throw this.duplicateOperation()
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
      throw this.roomNotFound()
    }

    const role = room.members.at(0)?.role

    if (!role) {
      throw this.permissionDenied("You must join this room first.")
    }

    if (!this.roomsPermissionService.canEdit(role)) {
      throw this.permissionDenied(
        "Only room owners and editors can edit this room.",
      )
    }
  }

  private async assertUniqueClientOpId(
    tx: WhiteboardTransactionClient,
    roomId: string,
    clientOpId: string,
  ): Promise<void> {
    const duplicateOperation = await tx.whiteboardOperation.findUnique({
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

    if (duplicateOperation) {
      throw this.duplicateOperation()
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
      throw this.objectNotFound()
    }

    if (object.deletedAt) {
      throw this.objectAlreadyDeleted()
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
      throw this.objectNotFound()
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
      throw this.objectNotFound()
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
      throw this.objectNotFound()
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
      throw this.objectNotFound()
    }

    if (object.deletedAt) {
      throw this.objectAlreadyDeleted()
    }

    throw this.objectVersionConflict(
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
      throw this.objectNotFound()
    }

    throw this.objectVersionConflict(
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

  private toCreateObjectData(
    roomId: string,
    createdById: string,
    input: ObjectCreateInput,
  ): Prisma.WhiteboardObjectUncheckedCreateInput {
    return {
      roomId,
      type: input.type,
      x: input.x,
      y: input.y,
      width: input.width ?? null,
      height: input.height ?? null,
      points: input.points ?? Prisma.DbNull,
      text: input.text ?? null,
      rotation: input.rotation ?? 0,
      style: this.toJsonValue(input.style ?? {}),
      zIndex: input.zIndex ?? 0,
      version: 1,
      createdById,
    }
  }

  private toUpdateObjectData(
    object: WhiteboardObjectRecord,
    patch: ObjectMutablePatch,
    updatedById: string,
  ): Prisma.WhiteboardObjectUncheckedUpdateManyInput {
    const data: Prisma.WhiteboardObjectUncheckedUpdateManyInput = {
      updatedById,
      version: {
        increment: 1,
      },
    }

    if ("x" in patch) {
      data.x = patch.x
    }

    if ("y" in patch) {
      data.y = patch.y
    }

    if ("width" in patch) {
      data.width = patch.width
    }

    if ("height" in patch) {
      data.height = patch.height
    }

    if ("points" in patch) {
      data.points = patch.points ?? Prisma.DbNull
    }

    if ("text" in patch) {
      data.text = patch.text ?? null
    }

    if ("rotation" in patch) {
      data.rotation = patch.rotation
    }

    if ("style" in patch && patch.style) {
      data.style = this.toJsonValue({
        ...toShapeStyle(object.style),
        ...patch.style,
      })
    }

    if ("zIndex" in patch) {
      data.zIndex = patch.zIndex
    }

    return data
  }

  private getPreviousValues(
    object: WhiteboardObjectRecord,
    patch: ObjectMutablePatch,
  ): ObjectMutablePatch {
    const previousValues: ObjectMutablePatch = {}

    if ("x" in patch) {
      previousValues.x = object.x
    }

    if ("y" in patch) {
      previousValues.y = object.y
    }

    if ("width" in patch) {
      previousValues.width = object.width ?? undefined
    }

    if ("height" in patch) {
      previousValues.height = object.height ?? undefined
    }

    if ("points" in patch) {
      previousValues.points = toWhiteboardObject(object).points ?? undefined
    }

    if ("text" in patch) {
      previousValues.text = object.text ?? undefined
    }

    if ("rotation" in patch) {
      previousValues.rotation = object.rotation
    }

    if ("style" in patch) {
      previousValues.style = toShapeStyle(object.style)
    }

    if ("zIndex" in patch) {
      previousValues.zIndex = object.zIndex
    }

    return previousValues
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
        payload: this.toJsonValue(input.payload),
        inversePayload:
          input.inversePayload === undefined
            ? Prisma.DbNull
            : this.toJsonValue(input.inversePayload),
      },
    })
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue
  }

  private normalizeOperationLimit(limit: number | undefined): number {
    if (!limit || !Number.isFinite(limit)) {
      return 50
    }

    return Math.min(Math.max(Math.trunc(limit), 1), 100)
  }

  private toOperationReplayEvent(operation: {
    id: string
    clientOpId: string
    roomId: string
    objectId?: string | null
    revision: bigint | number
    type: string
    payload: unknown
    createdAt: Date | string
    actor: UserSummary
  }): OperationAppliedEvent {
    return toOperationAppliedEvent({
      operation,
      actor: operation.actor,
      payload: operation.payload,
      resultingObject: this.getReplayResultingObject(
        operation.type,
        operation.payload,
      ),
    })
  }

  private getReplayResultingObject(
    operationType: string,
    payload: unknown,
  ): WhiteboardObject | null {
    if (operationType === "OBJECT_DELETE" || !this.isRecord(payload)) {
      return null
    }

    const payloadKey =
      operationType === "OBJECT_CREATE" ? "object" : "resultingObject"
    const parsed = whiteboardObjectSchema.safeParse(payload[payloadKey])

    return parsed.success ? parsed.data : null
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  private isDuplicateClientOperationConstraintError(error: unknown): boolean {
    if (!this.isPrismaUniqueConstraintError(error)) {
      return false
    }

    const target = error.meta?.target

    if (Array.isArray(target)) {
      return target.includes("roomId") && target.includes("clientOpId")
    }

    return target === "WhiteboardOperation_roomId_clientOpId_key"
  }

  private isPrismaUniqueConstraintError(
    error: unknown,
  ): error is { code: "P2002"; meta?: { target?: unknown } } {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    )
  }

  private roomNotFound() {
    return new NotFoundException({
      code: "ROOM_NOT_FOUND",
      message: "Room not found.",
    })
  }

  private objectNotFound() {
    return new NotFoundException({
      code: "OBJECT_NOT_FOUND",
      message: "Whiteboard object not found.",
    })
  }

  private objectAlreadyDeleted() {
    return new ConflictException({
      code: "OBJECT_ALREADY_DELETED",
      message: "Whiteboard object has already been deleted.",
    })
  }

  private objectVersionConflict(
    latestObject: WhiteboardObject,
    currentRoomRevision?: number,
  ) {
    return new ConflictException({
      code: "OBJECT_VERSION_CONFLICT",
      message: "Whiteboard object has changed since your last edit.",
      details: {
        latestObject,
        currentRoomRevision,
      },
    })
  }

  private duplicateOperation() {
    return new ConflictException({
      code: "DUPLICATE_OPERATION",
      message: "This client operation has already been processed.",
    })
  }

  private permissionDenied(message: string) {
    return new ForbiddenException({
      code: "PERMISSION_DENIED",
      message,
    })
  }
}
