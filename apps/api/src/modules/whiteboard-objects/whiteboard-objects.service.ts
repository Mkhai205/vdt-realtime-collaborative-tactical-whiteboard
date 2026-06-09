import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Prisma, type PrismaClient } from "@rctw/database"
import type {
  GetRoomObjectsResponse,
  ObjectCreateInput,
  ObjectCreateRequest,
  ObjectDeleteRequest,
  ObjectMutablePatch,
  ObjectUpdateRequest,
  OperationAppliedEvent,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { RoomsPermissionService } from "../rooms"
import {
  toOperationAppliedEvent,
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

  async createObject(
    currentUser: UserSummary,
    roomId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.prismaService.client.$transaction(async (tx) => {
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
    return this.prismaService.client.$transaction(async (tx) => {
      await this.assertCanMutateRoom(tx, currentUser.id, roomId)
      await this.assertUniqueClientOpId(tx, roomId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(
        tx,
        roomId,
        objectId,
        request.baseObjectVersion,
      )
      const previousValues = this.getPreviousValues(
        currentObject,
        request.patch,
      )
      const updatedObject = await tx.whiteboardObject.update({
        where: {
          id: objectId,
        },
        data: this.toUpdateObjectData(
          currentObject,
          request.patch,
          currentUser.id,
        ),
      })
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
    return this.prismaService.client.$transaction(async (tx) => {
      await this.assertCanMutateRoom(tx, currentUser.id, roomId)
      await this.assertUniqueClientOpId(tx, roomId, request.clientOpId)

      const currentObject = await this.loadObjectForMutation(
        tx,
        roomId,
        objectId,
        request.baseObjectVersion,
      )
      const previousObject = toWhiteboardObject(currentObject)
      const deletedObject = await tx.whiteboardObject.update({
        where: {
          id: objectId,
        },
        data: {
          deletedAt: new Date(),
          updatedById: currentUser.id,
          version: {
            increment: 1,
          },
        },
      })
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
    baseObjectVersion: number,
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

    if (object.version !== baseObjectVersion) {
      throw this.objectVersionConflict(toWhiteboardObject(object))
    }

    return object
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
  ): Prisma.WhiteboardObjectUncheckedUpdateInput {
    const data: Prisma.WhiteboardObjectUncheckedUpdateInput = {
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
      type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE"
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

  private objectVersionConflict(latestObject: WhiteboardObject) {
    return new ConflictException({
      code: "OBJECT_VERSION_CONFLICT",
      message: "Whiteboard object has changed since your last edit.",
      details: {
        latestObject,
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
