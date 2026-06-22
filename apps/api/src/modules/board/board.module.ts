import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { AuthModule } from "../auth/auth.module"
import { BoardController } from "./board.controller"
import { BoardHistoryService } from "./board-history.service"
import { BoardObjectsMutationService } from "./board-objects-mutation.service"
import { BoardObjectsQueryService } from "./board-objects-query.service"
import { BoardObjectsService } from "./board-objects.service"
import { BoardPermissionService } from "./board-permission.service"
import { BoardSnapshotsService } from "./board-snapshots.service"
import { BoardService } from "./board.service"

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BoardController],
  providers: [
    BoardService,
    BoardObjectsService,
    BoardObjectsMutationService,
    BoardObjectsQueryService,
    BoardPermissionService,
    BoardSnapshotsService,
    BoardHistoryService,
  ],
  exports: [BoardService, BoardObjectsService, BoardPermissionService],
})
export class BoardModule {}
