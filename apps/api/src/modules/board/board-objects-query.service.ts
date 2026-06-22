import { Injectable } from "@nestjs/common"
import {
  type GetBoardObjectsResponse,
  type GetBoardOperationsQuery,
  type GetBoardOperationsResponse,
  type SyncResponse,
  type JwtPayload,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { boardNotFound } from "./board.utils"
import {
  toOperationSummary,
  toWhiteboardObject,
  type WhiteboardObjectRecord,
} from "./mappers/board-object-response.mapper"
import { toOperationReplayEvent } from "./mappers/board-operation-replay.mapper"

const maxOperationReplayCount = 100

@Injectable()
export class BoardObjectsQueryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  async getBoardObjects(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardObjectsResponse> {
    await this.boardPermissionService.assertBoardMember(
      currentUser.sub,
      boardId,
    )

    const board = await this.prismaService.board.findFirst({
      where: { id: boardId },
      select: { currentRevision: true },
    })

    if (!board) {
      throw boardNotFound()
    }

    const objects = await this.getActiveBoardObjects(boardId)

    return {
      boardId,
      currentRevision: board.currentRevision,
      objects: objects.map(toWhiteboardObject),
    }
  }

  async getBoardOperations(
    currentUser: JwtPayload,
    boardId: string,
    query: Partial<GetBoardOperationsQuery> = {},
  ): Promise<GetBoardOperationsResponse> {
    await this.boardPermissionService.assertBoardMember(
      currentUser.sub,
      boardId,
    )

    const operations = await this.prismaService.boardOperation.findMany({
      where: { boardId },
      orderBy: { revision: "desc" },
      take: normalizeOperationLimit(query.limit),
      select: {
        id: true,
        clientOpId: true,
        boardId: true,
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
          select: { type: true },
        },
      },
    })

    return {
      boardId,
      operations: operations.map(toOperationSummary),
    }
  }

  async getBoardOperationReplay(
    currentUser: JwtPayload,
    boardId: string,
    lastSeenRevision: number,
  ): Promise<SyncResponse> {
    await this.boardPermissionService.assertBoardMember(
      currentUser.sub,
      boardId,
    )

    const board = await this.prismaService.board.findFirst({
      where: { id: boardId },
      select: { currentRevision: true },
    })

    if (!board) {
      throw boardNotFound()
    }

    const currentRevision = board.currentRevision

    if (lastSeenRevision === currentRevision) {
      return {
        mode: "OPERATIONS",
        boardId,
        fromRevision: lastSeenRevision,
        toRevision: currentRevision,
        operations: [],
      }
    }

    if (
      lastSeenRevision > currentRevision ||
      currentRevision - lastSeenRevision > maxOperationReplayCount
    ) {
      return this.getFullStateSyncResponse(boardId, currentRevision)
    }

    const operations = await this.prismaService.boardOperation.findMany({
      where: {
        boardId,
        revision: {
          gt: lastSeenRevision,
          lte: currentRevision,
        },
      },
      orderBy: { revision: "asc" },
      select: {
        id: true,
        clientOpId: true,
        boardId: true,
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

    if (
      !isCompleteOperationReplay(operations, lastSeenRevision, currentRevision)
    ) {
      return this.getFullStateSyncResponse(boardId, currentRevision)
    }

    return {
      mode: "OPERATIONS",
      boardId,
      fromRevision: lastSeenRevision,
      toRevision: currentRevision,
      operations: operations.map(toOperationReplayEvent),
    }
  }

  private async getActiveBoardObjects(
    boardId: string,
  ): Promise<WhiteboardObjectRecord[]> {
    return this.prismaService.boardObject.findMany({
      where: { boardId, deletedAt: null },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })
  }

  private async getFullStateSyncResponse(
    boardId: string,
    revision: number,
  ): Promise<SyncResponse> {
    const objects = await this.getActiveBoardObjects(boardId)

    return {
      mode: "FULL_STATE",
      boardId,
      revision,
      objects: objects.map(toWhiteboardObject),
    }
  }
}

function isCompleteOperationReplay(
  operations: Array<{ revision: number }>,
  lastSeenRevision: number,
  currentRevision: number,
): boolean {
  if (operations.length !== currentRevision - lastSeenRevision) {
    return false
  }

  return operations.every(
    (operation, index) => operation.revision === lastSeenRevision + index + 1,
  )
}

function normalizeOperationLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) {
    return 50
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100)
}
