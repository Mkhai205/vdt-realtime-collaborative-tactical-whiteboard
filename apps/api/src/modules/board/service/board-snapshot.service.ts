import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { Prisma, type PrismaClient } from "@rctw/database"
import { type BoardObjectDto, type JwtPayload, operationTypes } from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"
import { toBoardObjectDto } from "./mappers/board-object-response.mapper"
import { BoardPermissionService } from "./board-permission.service"
import { BoardEventsService } from "./board-events.service"


// ─── Types ─────────────────────────────────────────────────────────────────────

/** Nội dung JSON được lưu trong boardSnapshot.data */
export type BoardSnapshotData = {
  objects: BoardObjectDto[]
}

export type BoardSnapshotResult = {
  id: string
  boardId: string
  revision: number
  data: BoardSnapshotData
  createdAt: string // ISO string
}

export type BoardSnapshotSummary = {
  id: string
  boardId: string
  revision: number
  createdAt: string // ISO string
}

/** Số operations tích lũy để trigger auto-snapshot */
const SNAPSHOT_OPERATION_THRESHOLD = 50

/** Transaction client type (subset của PrismaClient an toàn trong tx) */
type TxClient = Pick<PrismaClient, "board" | "boardSnapshot" | "boardObject">

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BoardSnapshotService {
  private readonly logger = new Logger(BoardSnapshotService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
    private readonly boardEventsService: BoardEventsService,
  ) {}

  // ── Write ───────────────────────────────────────────────────────────────────

  /**
   * Tạo snapshot thủ công bởi user. Yêu cầu quyền EDITOR/OWNER.
   */
  async createManualSnapshot(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<BoardSnapshotResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )
    return this.createSnapshot(boardId)
  }

  /**
   * Tạo snapshot tại revision hiện tại của board.
   * Idempotent: nếu snapshot cho revision này đã tồn tại, trả về snapshot đó.
   * Dùng RepeatableRead để đảm bảo currentRevision và objects nhất quán.
   */
  async createSnapshot(boardId: string): Promise<BoardSnapshotResult> {
    const result = await this.prisma.$transaction(
      (tx) => this.createSnapshotInTx(tx as unknown as TxClient, boardId),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )

    // Tự động dọn dẹp các operations cũ sau khi tạo snapshot thành công
    void this.purgeOldOperations(boardId)

    return result
  }

  /**
   * Kiểm tra và tạo auto-snapshot nếu đủ điều kiện.
   * Gọi sau mỗi write operation trong WhiteboardMutationService.
   *
   * Trigger nếu:
   * - Số operations từ lần snapshot cuối ≥ SNAPSHOT_OPERATION_THRESHOLD
   */
  async maybeAutoSnapshot(boardId: string): Promise<void> {
    try {
      const [board, latestSnapshot] = await Promise.all([
        this.prisma.board.findUnique({
          where: { id: boardId },
          select: { currentRevision: true },
        }),
        this.prisma.boardSnapshot.findFirst({
          where: { boardId },
          orderBy: { revision: "desc" },
          select: { revision: true },
        }),
      ])

      if (!board) return

      const lastSnapshotRevision = latestSnapshot?.revision ?? 0
      const operationsSinceSnapshot =
        board.currentRevision - lastSnapshotRevision

      if (operationsSinceSnapshot >= SNAPSHOT_OPERATION_THRESHOLD) {
        await this.createSnapshot(boardId)
        this.logger.log(
          `Auto-snapshot created for board ${boardId} at revision ${board.currentRevision}`,
        )
      }
    } catch (error) {
      // Auto-snapshot không được làm crash flow chính
      this.logger.error(
        `Auto-snapshot failed for board ${boardId}: ${String(error)}`,
      )
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async listSnapshots(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<BoardSnapshotSummary[]> {
    await this.boardPermissionService.resolveAccess(currentUser.sub, boardId)

    const snapshots = await this.prisma.boardSnapshot.findMany({
      where: { boardId },
      orderBy: { revision: "desc" },
      select: { id: true, boardId: true, revision: true, createdAt: true },
    })

    return snapshots.map((s) => ({
      id: s.id,
      boardId: s.boardId,
      revision: s.revision,
      createdAt: toIsoString(s.createdAt),
    }))
  }

  async getSnapshot(
    currentUser: JwtPayload,
    boardId: string,
    snapshotId: string,
  ): Promise<BoardSnapshotResult> {
    await this.boardPermissionService.resolveAccess(currentUser.sub, boardId)

    const snapshot = await this.prisma.boardSnapshot.findFirst({
      where: { id: snapshotId, boardId },
    })

    if (!snapshot) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Snapshot not found.",
      })
    }

    return toSnapshotResult(snapshot)
  }

  async restoreSnapshot(
    currentUser: JwtPayload,
    boardId: string,
    snapshotId: string,
  ): Promise<BoardSnapshotResult> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const result = await this.prisma.$transaction(
      async (tx) => {
        const snapshot = await tx.boardSnapshot.findFirst({
          where: { id: snapshotId, boardId },
        })

        if (!snapshot) {
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Snapshot not found.",
          })
        }

        const snapshotData = parseSnapshotData(snapshot.data)

        // 1. Delete all current operations for this board
        await tx.boardOperation.deleteMany({
          where: { boardId },
        })

        // 2. Delete all current objects for this board
        await tx.boardObject.deleteMany({
          where: { boardId },
        })

        // 3. Create all objects from the snapshot
        if (snapshotData.objects && snapshotData.objects.length > 0) {
          await tx.boardObject.createMany({
            data: snapshotData.objects.map((obj) => ({
              id: obj.id,
              boardId: boardId,
              type: obj.type,
              x: obj.x,
              y: obj.y,
              width: obj.width ?? null,
              height: obj.height ?? null,
              points: obj.points != null ? (obj.points as Prisma.InputJsonValue) : Prisma.JsonNull,
              text: obj.text ?? null,
              rotation: obj.rotation,
              style: obj.style as Prisma.InputJsonValue,
              zIndex: obj.zIndex,
              version: obj.version,
              createdById: obj.createdById,
              updatedById: obj.updatedById,
              createdAt: new Date(obj.createdAt),
              updatedAt: new Date(obj.updatedAt),
            })),
          })
        }

        // 4. Update board revision to snapshot.revision + 1
        const newRevision = snapshot.revision + 1
        await tx.board.update({
          where: { id: boardId },
          data: { currentRevision: newRevision },
        })

        // 5. Create restore operation
        await tx.boardOperation.create({
          data: {
            clientOpId: `restore-${Date.now()}`,
            boardId,
            actorId: currentUser.sub,
            revision: newRevision,
            type: operationTypes.OBJECT_RESTORE,
            payload: snapshotData as unknown as Prisma.InputJsonValue,
            inversePayload: Prisma.DbNull,
          },
        })

        return toSnapshotResult(snapshot)
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    // Emit event via BoardEventsService
    const restoredObjects = await this.prisma.boardObject.findMany({
      where: { boardId, deletedAt: null },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })

    this.boardEventsService.emitBoardRestored({
      boardId,
      revision: result.revision + 1, // matches newRevision
      objects: restoredObjects.map(toBoardObjectDto),
    })

    return result
  }

  async getLatestSnapshot(boardId: string): Promise<BoardSnapshotResult> {
    const snapshot = await this.prisma.boardSnapshot.findFirst({
      where: { boardId },
      orderBy: { revision: "desc" },
    })

    if (!snapshot) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "No snapshots found for this board.",
      })
    }

    return toSnapshotResult(snapshot)
  }

  // ── Scheduled job: time-based auto-snapshot ─────────────────────────────────

  /**
   * Chạy mỗi 5 phút, tạo snapshot cho tất cả boards nếu chưa có snapshot
   * trong 5 phút gần đây và có ít nhất 1 operation mới.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSnapshotJob(): Promise<void> {
    this.logger.debug("Running scheduled snapshot job...")

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

      // Lấy danh sách boardId có operation mới nhưng chưa có snapshot gần đây
      const boardsNeedingSnapshot = await this.prisma.board.findMany({
        where: {
          currentRevision: { gt: 0 },
          // Board chưa có snapshot nào trong 5 phút gần đây
          snapshots: {
            none: { createdAt: { gte: fiveMinutesAgo } },
          },
          // Board có ít nhất 1 operation (currentRevision > 0)
          operations: { some: {} },
        },
        select: { id: true, currentRevision: true },
      })

      if (boardsNeedingSnapshot.length === 0) {
        this.logger.debug("No boards need scheduled snapshot.")
        return
      }

      for (const board of boardsNeedingSnapshot) {
        // Kiểm tra revision threshold để tránh snapshot board không có gì mới
        const latestSnapshot = await this.prisma.boardSnapshot.findFirst({
          where: { boardId: board.id },
          orderBy: { revision: "desc" },
          select: { revision: true },
        })

        const lastRevision = latestSnapshot?.revision ?? 0
        if (board.currentRevision <= lastRevision) continue

        await this.createSnapshot(board.id).catch((err) => {
          this.logger.error(
            `Scheduled snapshot failed for board ${board.id}: ${String(err)}`,
          )
        })
      }

      this.logger.log(
        `Scheduled snapshot job completed for ${boardsNeedingSnapshot.length} board(s).`,
      )
    } catch (error) {
      this.logger.error(`Scheduled snapshot job error: ${String(error)}`)
    }
  }

  /**
   * Xóa các operations cũ đã được gộp vào Snapshot mới nhất của board này
   */
  async purgeOldOperations(boardId: string): Promise<void> {
    try {
      const latestSnapshot = await this.prisma.boardSnapshot.findFirst({
        where: { boardId },
        orderBy: { revision: "desc" },
        select: { revision: true },
      })

      if (!latestSnapshot) return

      const result = await this.prisma.boardOperation.deleteMany({
        where: {
          boardId,
          revision: { lt: latestSnapshot.revision },
        },
      })

      if (result.count > 0) {
        this.logger.log(
          `Purged ${result.count} old operations for board ${boardId} (revision < ${latestSnapshot.revision})`,
        )
      }
    } catch (error) {
      this.logger.error(
        `Failed to purge operations for board ${boardId}: ${String(error)}`,
      )
    }
  }

  /**
   * Định kỳ dọn dẹp hàng ngày lúc 2 giờ sáng
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyPurgeJob(): Promise<void> {
    this.logger.log("Running scheduled daily operation purge job...")
    try {
      const boards = await this.prisma.board.findMany({
        select: { id: true },
      })

      for (const board of boards) {
        await this.purgeOldOperations(board.id)
      }

      this.logger.log(
        `Daily operations purge job completed for ${boards.length} board(s).`,
      )
    } catch (error) {
      this.logger.error(`Daily operations purge job failed: ${String(error)}`)
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async createSnapshotInTx(
    tx: TxClient,
    boardId: string,
  ): Promise<BoardSnapshotResult> {
    const board = await tx.board.findFirst({
      where: { id: boardId },
      select: { currentRevision: true },
    })

    if (!board) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Board not found.",
      })
    }

    const revision = board.currentRevision

    // Idempotency: trả về snapshot hiện có nếu đã tồn tại
    const existing = await tx.boardSnapshot.findUnique({
      where: { boardId_revision: { boardId, revision } },
    })

    if (existing) {
      return toSnapshotResult(existing)
    }

    // Lấy tất cả objects hiện tại
    const objects = await tx.boardObject.findMany({
      where: { boardId, deletedAt: null },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })

    const data: BoardSnapshotData = {
      objects: objects.map(toBoardObjectDto),
    }

    // skipDuplicates để xử lý race condition
    await tx.boardSnapshot.createMany({
      data: [{ boardId, revision, data: data as Prisma.InputJsonValue }],
      skipDuplicates: true,
    })

    const created = await tx.boardSnapshot.findUnique({
      where: { boardId_revision: { boardId, revision } },
    })

    if (!created) {
      throw new InternalServerErrorException({
        code: "INTERNAL_ERROR",
        message: "Snapshot could not be created.",
      })
    }

    return toSnapshotResult(created)
  }
}

// ─── File-level helpers ────────────────────────────────────────────────────────

function toSnapshotResult(snapshot: {
  id: string
  boardId: string
  revision: number
  data: unknown
  createdAt: Date | string
}): BoardSnapshotResult {
  return {
    id: snapshot.id,
    boardId: snapshot.boardId,
    revision: snapshot.revision,
    data: parseSnapshotData(snapshot.data),
    createdAt: toIsoString(snapshot.createdAt),
  }
}

function parseSnapshotData(value: unknown): BoardSnapshotData {
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { objects?: unknown }).objects)
  ) {
    return value as BoardSnapshotData
  }
  return { objects: [] }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
