import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { Prisma, type PrismaClient } from "@rctw/database"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { toWhiteboardObject } from "../whiteboard-objects/whiteboard-object-response.mapper"

type WhiteboardSnapshotTransactionClient = Pick<
  PrismaClient,
  "room" | "roomSnapshot" | "whiteboardObject"
>

export type RoomSnapshotData = {
  objects: WhiteboardObject[]
}

export type RoomSnapshotResult = {
  id: string
  roomId: string
  revision: number
  data: RoomSnapshotData
  createdAt: string
}

type RoomSnapshotRecord = {
  id: string
  roomId: string
  revision: bigint | number
  data: unknown
  createdAt: Date | string
}

@Injectable()
export class WhiteboardSnapshotsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createSnapshot(roomId: string): Promise<RoomSnapshotResult> {
    return this.prismaService.$transaction(
      async (tx) => this.createSnapshotInTransaction(tx, roomId),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    )
  }

  private async createSnapshotInTransaction(
    tx: WhiteboardSnapshotTransactionClient,
    roomId: string,
  ): Promise<RoomSnapshotResult> {
    const room = await tx.room.findFirst({
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

    const revision = room.currentRevision
    const existingSnapshot = await this.findSnapshot(tx, roomId, revision)

    if (existingSnapshot) {
      return this.toRoomSnapshotResult(existingSnapshot)
    }

    const objects = await tx.whiteboardObject.findMany({
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
    const data: RoomSnapshotData = {
      objects: objects.map(toWhiteboardObject),
    }

    await tx.roomSnapshot.createMany({
      data: [
        {
          roomId,
          revision,
          data: this.toJsonValue(data),
        },
      ],
      skipDuplicates: true,
    })

    const snapshot = await this.findSnapshot(tx, roomId, revision)

    if (!snapshot) {
      throw this.snapshotCreationFailed()
    }

    return this.toRoomSnapshotResult(snapshot)
  }

  private findSnapshot(
    tx: WhiteboardSnapshotTransactionClient,
    roomId: string,
    revision: bigint | number,
  ) {
    return tx.roomSnapshot.findUnique({
      where: {
        roomId_revision: {
          roomId,
          revision,
        },
      },
    })
  }

  private toRoomSnapshotResult(
    snapshot: RoomSnapshotRecord,
  ): RoomSnapshotResult {
    return {
      id: snapshot.id,
      roomId: snapshot.roomId,
      revision: Number(snapshot.revision),
      data: this.toSnapshotData(snapshot.data),
      createdAt: this.toIsoString(snapshot.createdAt),
    }
  }

  private toSnapshotData(value: unknown): RoomSnapshotData {
    if (
      value &&
      typeof value === "object" &&
      Array.isArray((value as { objects?: unknown }).objects)
    ) {
      return {
        objects: (value as RoomSnapshotData).objects,
      }
    }

    return {
      objects: [],
    }
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value
  }

  private roomNotFound() {
    return new NotFoundException({
      code: "ROOM_NOT_FOUND",
      message: "Room not found.",
    })
  }

  private snapshotCreationFailed() {
    return new InternalServerErrorException({
      code: "INTERNAL_ERROR",
      message: "Room snapshot could not be created.",
    })
  }
}
