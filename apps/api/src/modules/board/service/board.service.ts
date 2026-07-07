import { Injectable } from "@nestjs/common"
import {
  BoardDetailResponse,
  BoardResponse,
  boardRoles,
  ListBoardsResponse,
  operationTypes,
  type CreateBoardRequest,
  type JwtPayload,
  type ListBoardsQuery,
  type UpdateBoardInfoRequest,
  type UpdateBoardSettingsRequest,
  type ImportBoardRequest,
  type ImportBoardObjectsRequest,
  type BoardObjectsResponse,
} from "@rctw/shared-contracts"
import { Prisma } from "@rctw/database"
import { userSummarySelect } from "../../user/user.service"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { BoardEventsService } from "./board-events.service"
import { toBoardObjectDto } from "./mappers/board-object-response.mapper"

export const boardSelect = {
  id: true,
  name: true,
  description: true,
  visibility: true,
  currentRevision: true,
  thumbnailUrl: true,
  createdBy: { select: userSummarySelect },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BoardSelect

export type BoardRecord = Prisma.BoardGetPayload<{ select: typeof boardSelect }>

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
    private readonly boardEventsService: BoardEventsService,
  ) {}

  async createBoard(
    currentUser: JwtPayload,
    request: CreateBoardRequest,
  ): Promise<BoardResponse> {
    const board = await this.prisma.board.create({
      data: {
        name: request.name,
        description: request.description ?? null,
        visibility: request.visibility,
        createdById: currentUser.sub,
        members: {
          create: {
            userId: currentUser.sub,
            role: boardRoles.OWNER,
          },
        },
      },
      select: boardSelect,
    })

    return toBoardResponse(board)
  }

  async listBoards(
    currentUser: JwtPayload,
    query: ListBoardsQuery,
  ): Promise<ListBoardsResponse> {
    const where = {
      members: {
        some: { userId: currentUser.sub },
      },
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    }

    const [boards, total] = await Promise.all([
      this.prisma.board.findMany({
        where,
        select: boardSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.board.count({ where }),
    ])

    return {
      items: boards.map(toBoardResponse),
      meta: { total, page: query.page, limit: query.limit },
    }
  }

  async getBoard(
    currentUser: JwtPayload | undefined,
    boardId: string,
  ): Promise<BoardDetailResponse> {
    const { board, effectiveRole } =
      await this.boardPermissionService.resolveAccess(currentUser?.sub, boardId)

    return {
      ...toBoardResponse(board),
      effectiveRole,
    }
  }

  async updateBoardInfo(
    currentUser: JwtPayload,
    boardId: string,
    request: UpdateBoardInfoRequest,
  ): Promise<BoardResponse> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(request.name !== undefined && { name: request.name }),
        ...(request.description !== undefined && {
          description: request.description,
        }),
        ...(request.thumbnailUrl !== undefined && {
          thumbnailUrl: request.thumbnailUrl,
        }),
      },
      select: boardSelect,
    })

    return toBoardResponse(board)
  }

  async updateBoardSettings(
    currentUser: JwtPayload,
    boardId: string,
    request: UpdateBoardSettingsRequest,
  ): Promise<BoardResponse> {
    await this.boardPermissionService.assertFormalOwner(
      currentUser.sub,
      boardId,
    )

    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(request.visibility !== undefined && {
          visibility: request.visibility,
        }),
      },
      select: boardSelect,
    })

    if (request.visibility !== undefined) {
      this.boardEventsService.emitVisibilityChanged({
        boardId: board.id,
        visibility: board.visibility,
      })
    }

    return toBoardResponse(board)
  }

  async deleteBoard(currentUser: JwtPayload, boardId: string): Promise<void> {
    await this.boardPermissionService.assertFormalOwner(
      currentUser.sub,
      boardId,
    )
    await this.prisma.board.delete({ where: { id: boardId } })
  }

  async importBoard(
    currentUser: JwtPayload,
    request: ImportBoardRequest,
  ): Promise<BoardResponse> {
    const board = await this.prisma.$transaction(async (tx) => {
      const createdBoard = await tx.board.create({
        data: {
          name: request.name,
          description: request.description ?? null,
          visibility: request.visibility,
          createdById: currentUser.sub,
          currentRevision: 1,
          members: {
            create: {
              userId: currentUser.sub,
              role: boardRoles.OWNER,
            },
          },
        },
        select: boardSelect,
      })

      for (const obj of request.objects) {
        await tx.boardObject.create({
          data: {
            boardId: createdBoard.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            width: obj.width ?? null,
            height: obj.height ?? null,
            points:
              obj.points != null
                ? (obj.points as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            text: obj.text ?? null,
            rotation: obj.rotation,
            style: obj.style as Prisma.InputJsonValue,
            zIndex: obj.zIndex,
            createdById: currentUser.sub,
          },
        })
      }

      return createdBoard
    })

    return toBoardResponse(board)
  }

  async importBoardObjects(
    currentUser: JwtPayload,
    boardId: string,
    request: ImportBoardObjectsRequest,
  ): Promise<BoardObjectsResponse> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const updatedObjects = await this.prisma.$transaction(async (tx) => {
      await tx.boardOperation.deleteMany({
        where: {
          boardId,
          actorId: currentUser.sub,
          type: operationTypes.OBJECT_RESTORE,
        },
      })

      const board = await tx.board.update({
        where: { id: boardId },
        data: { currentRevision: { increment: 1 } },
        select: { currentRevision: true },
      })
      const revision = board.currentRevision

      let zIndexOffset = 0
      if (request.mode === "OVERWRITE") {
        await tx.boardObject.updateMany({
          where: { boardId, deletedAt: null },
          data: {
            deletedAt: new Date(),
            updatedById: currentUser.sub,
          },
        })
      } else if (request.mode === "APPEND") {
        const agg = await tx.boardObject.aggregate({
          where: { boardId, deletedAt: null },
          _max: { zIndex: true },
        })
        zIndexOffset = (agg._max.zIndex ?? -1) + 1
      }

      for (const obj of request.objects) {
        await tx.boardObject.create({
          data: {
            boardId,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            width: obj.width ?? null,
            height: obj.height ?? null,
            points:
              obj.points != null
                ? (obj.points as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            text: obj.text ?? null,
            rotation: obj.rotation,
            style: obj.style as Prisma.InputJsonValue,
            zIndex: obj.zIndex + zIndexOffset,
            createdById: currentUser.sub,
          },
        })
      }

      const allActiveObjects = await tx.boardObject.findMany({
        where: { boardId, deletedAt: null },
        orderBy: { zIndex: "asc" },
      })

      return {
        revision,
        objects: allActiveObjects.map((row) => toBoardObjectDto(row)),
      }
    })

    this.boardEventsService.emitBoardRestored({
      boardId,
      revision: updatedObjects.revision,
      objects: updatedObjects.objects,
    })

    return updatedObjects
  }
}

function toBoardResponse(board: BoardRecord): BoardResponse {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    visibility: board.visibility,
    currentRevision: board.currentRevision,
    thumbnailUrl: board.thumbnailUrl,
    createdBy: board.createdBy,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  }
}
