import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { Prisma, type PrismaClient } from "@rctw/database"
import { apiErrorCodes, type WhiteboardObject } from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { toWhiteboardObject } from "./mappers/board-object-response.mapper"

type BoardSnapshotTransactionClient = Pick<
  PrismaClient,
  "board" | "boardSnapshot" | "boardObject"
>

export type BoardSnapshotData = {
  objects: WhiteboardObject[]
}

export type BoardSnapshotResult = {
  id: string
  boardId: string
  revision: number
  data: BoardSnapshotData
  createdAt: string
}

type BoardSnapshotRecord = {
  id: string
  boardId: string
  revision: number
  data: unknown
  createdAt: Date | string
}

@Injectable()
export class WhiteboardSnapshotsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createSnapshot(boardId: string): Promise<BoardSnapshotResult> {
    return this.prismaService.$transaction(
      async (tx) => this.createSnapshotInTransaction(tx, boardId),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    )
  }

  private async createSnapshotInTransaction(
    tx: BoardSnapshotTransactionClient,
    boardId: string,
  ): Promise<BoardSnapshotResult> {
    const board = await tx.board.findFirst({
      where: {
        id: boardId,
      },
      select: {
        currentRevision: true,
      },
    })

    if (!board) {
      throw this.boardNotFound()
    }

    const revision = board.currentRevision
    const existingSnapshot = await this.findSnapshot(tx, boardId, revision)

    if (existingSnapshot) {
      return this.toBoardSnapshotResult(existingSnapshot)
    }

    const objects = await tx.boardObject.findMany({
      where: {
        boardId,
        deletedAt: null,
      },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })

    const data: BoardSnapshotData = {
      objects: objects.map(toWhiteboardObject),
    }

    await tx.boardSnapshot.createMany({
      data: [
        {
          boardId,
          revision,
          data: this.toJsonValue(data),
        },
      ],
      skipDuplicates: true,
    })

    const snapshot = await this.findSnapshot(tx, boardId, revision)

    if (!snapshot) {
      throw this.snapshotCreationFailed()
    }

    return this.toBoardSnapshotResult(snapshot)
  }

  private findSnapshot(
    tx: BoardSnapshotTransactionClient,
    boardId: string,
    revision: number,
  ) {
    return tx.boardSnapshot.findUnique({
      where: {
        boardId_revision: {
          boardId,
          revision,
        },
      },
    })
  }

  private toBoardSnapshotResult(
    snapshot: BoardSnapshotRecord,
  ): BoardSnapshotResult {
    return {
      id: snapshot.id,
      boardId: snapshot.boardId,
      revision: snapshot.revision,
      data: this.toSnapshotData(snapshot.data),
      createdAt: this.toIsoString(snapshot.createdAt),
    }
  }

  private toSnapshotData(value: unknown): BoardSnapshotData {
    if (
      value &&
      typeof value === "object" &&
      Array.isArray((value as { objects?: unknown }).objects)
    ) {
      return {
        objects: (value as BoardSnapshotData).objects,
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

  private boardNotFound(message = "Board not found.") {
    return new NotFoundException({
      code: apiErrorCodes.BOARD_NOT_FOUND,
      message,
    })
  }

  private snapshotCreationFailed() {
    return new InternalServerErrorException({
      code: "INTERNAL_ERROR",
      message: "Board snapshot could not be created.",
    })
  }
}
