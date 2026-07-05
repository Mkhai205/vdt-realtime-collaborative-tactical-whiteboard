import { Injectable } from "@nestjs/common"
import {
  type BoardObjectsResponse,
  type BoardOperationsResponse,
  type BoardOperationsQuery,
  type JwtPayload,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { toBoardObjectDto } from "./mappers/board-object-response.mapper"

@Injectable()
export class WhiteboardQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
  ) {}

  /**
   * Trả về tất cả objects hiện tại của board (deletedAt = null).
   * Dùng khi client join board lần đầu hoặc cần full state.
   */
  async getBoardObjects(
    currentUser: JwtPayload | undefined,
    boardId: string,
  ): Promise<BoardObjectsResponse> {
    // Kiểm tra quyền truy cập (ném lỗi nếu không có quyền)
    await this.boardPermissionService.resolveAccess(currentUser?.sub, boardId)

    const [board, objects] = await Promise.all([
      this.prisma.board.findUniqueOrThrow({
        where: { id: boardId },
        select: { currentRevision: true },
      }),
      this.prisma.boardObject.findMany({
        where: { boardId, deletedAt: null },
        orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
      }),
    ])

    return {
      revision: board.currentRevision,
      objects: objects.map(toBoardObjectDto),
    }
  }

  /**
   * Trả về danh sách operations từ `fromRevision` (exclusive) đến `currentRevision`.
   * Dùng khi client reconnect để sync delta, không cần tải lại toàn bộ state.
   */
  async getBoardOperationReplay(
    currentUser: JwtPayload | undefined,
    boardId: string,
    query: BoardOperationsQuery,
  ): Promise<BoardOperationsResponse> {
    await this.boardPermissionService.resolveAccess(currentUser?.sub, boardId)

    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const fromRevision = query.fromRevision ?? 0

    const [board, operations, total] = await Promise.all([
      this.prisma.board.findUniqueOrThrow({
        where: { id: boardId },
        select: { currentRevision: true },
      }),
      this.prisma.boardOperation.findMany({
        where: {
          boardId,
          revision: { gt: fromRevision },
        },
        orderBy: { revision: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          clientOpId: true,
          boardId: true,
          revision: true,
          actorId: true,
          objectId: true,
          type: true,
          baseObjectVersion: true,
          payload: true,
          createdAt: true,
        },
      }),
      this.prisma.boardOperation.count({
        where: {
          boardId,
          revision: { gt: fromRevision },
        },
      }),
    ])

    const fetchedCount = (page - 1) * limit + operations.length

    return {
      latestRevision: board.currentRevision,
      hasMore: fetchedCount < total,
      operations: operations.map((op) => ({
        id: op.id,
        clientOpId: op.clientOpId,
        boardId: op.boardId,
        revision: op.revision,
        actorId: op.actorId,
        objectId: op.objectId ?? null,
        type: op.type,
        baseObjectVersion: op.baseObjectVersion ?? null,
        payload: op.payload,
        createdAt: op.createdAt.toISOString(),
      })),
    }
  }
}
