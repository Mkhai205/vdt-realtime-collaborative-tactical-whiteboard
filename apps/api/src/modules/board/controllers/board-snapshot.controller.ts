import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { BoardSnapshotService } from "../service/board-snapshot.service"
import type {
  BoardSnapshotSummaryResponse,
  BoardSnapshotDetailResponse,
  JwtPayload,
} from "@rctw/shared-contracts"

@Controller("boards")
export class BoardSnapshotController {
  constructor(private readonly snapshotService: BoardSnapshotService) {}

  @Get(":boardId/snapshots")
  async listSnapshots(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<BoardSnapshotSummaryResponse[]> {
    return this.snapshotService.listSnapshots(currentUser, boardId)
  }

  @Get(":boardId/snapshots/:snapshotId")
  async getSnapshot(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
  ): Promise<BoardSnapshotDetailResponse> {
    return this.snapshotService.getSnapshot(currentUser, boardId, snapshotId)
  }

  @Post(":boardId/snapshots")
  async createSnapshot(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
  ): Promise<BoardSnapshotDetailResponse> {
    return this.snapshotService.createManualSnapshot(currentUser, boardId)
  }

  @Post(":boardId/snapshots/:snapshotId/restore")
  async restoreSnapshot(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
  ): Promise<BoardSnapshotDetailResponse> {
    return this.snapshotService.restoreSnapshot(
      currentUser,
      boardId,
      snapshotId,
    )
  }
}
