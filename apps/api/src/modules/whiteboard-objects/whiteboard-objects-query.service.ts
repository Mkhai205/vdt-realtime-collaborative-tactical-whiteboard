import { Injectable } from "@nestjs/common"
import {
  type GetRoomObjectsResponse,
  type GetRoomOperationsQuery,
  type GetRoomOperationsResponse,
  type SyncResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { RoomsPermissionService } from "../rooms"
import { roomNotFound } from "./whiteboard-object-errors"
import {
  toOperationSummary,
  toWhiteboardObject,
  type WhiteboardObjectRecord,
} from "./whiteboard-object-response.mapper"
import { toOperationReplayEvent } from "./whiteboard-operation-replay.mapper"

const maxOperationReplayCount = 100

@Injectable()
export class WhiteboardObjectsQueryService {
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
      throw roomNotFound()
    }

    const objects = await this.getActiveRoomObjects(roomId)

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
        take: normalizeOperationLimit(query.limit),
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
  ): Promise<SyncResponse> {
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
      throw roomNotFound()
    }

    const currentRevision = Number(room.currentRevision)

    if (lastSeenRevision === currentRevision) {
      return {
        mode: "OPERATIONS",
        roomId,
        fromRevision: lastSeenRevision,
        toRevision: currentRevision,
        operations: [],
      }
    }

    if (
      lastSeenRevision > currentRevision ||
      currentRevision - lastSeenRevision > maxOperationReplayCount
    ) {
      return this.getFullStateSyncResponse(roomId, currentRevision)
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

    if (
      !isCompleteOperationReplay(operations, lastSeenRevision, currentRevision)
    ) {
      return this.getFullStateSyncResponse(roomId, currentRevision)
    }

    return {
      mode: "OPERATIONS",
      roomId,
      fromRevision: lastSeenRevision,
      toRevision: currentRevision,
      operations: operations.map(toOperationReplayEvent),
    }
  }

  private async getActiveRoomObjects(
    roomId: string,
  ): Promise<WhiteboardObjectRecord[]> {
    return this.prismaService.client.whiteboardObject.findMany({
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
  }

  private async getFullStateSyncResponse(
    roomId: string,
    revision: number,
  ): Promise<SyncResponse> {
    const objects = await this.getActiveRoomObjects(roomId)

    return {
      mode: "FULL_STATE",
      roomId,
      revision,
      objects: objects.map(toWhiteboardObject),
    }
  }
}

function isCompleteOperationReplay(
  operations: Array<{ revision: bigint | number }>,
  lastSeenRevision: number,
  currentRevision: number,
): boolean {
  if (operations.length !== currentRevision - lastSeenRevision) {
    return false
  }

  return operations.every(
    (operation, index) =>
      Number(operation.revision) === lastSeenRevision + index + 1,
  )
}

function normalizeOperationLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) {
    return 50
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100)
}
