import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { AuthModule } from "../auth/auth.module"
import { BoardModule } from "../board/board.module"
import { WhiteboardController } from "./whiteboard.controller"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"
import { WhiteboardObjectsMutationService } from "./whiteboard-objects-mutation.service"
import { WhiteboardObjectsQueryService } from "./whiteboard-objects-query.service"
import { WhiteboardSnapshotsService } from "./whiteboard-snapshots.service"
import { WhiteboardHistoryService } from "./whiteboard-history.service"

@Module({
  imports: [DatabaseModule, AuthModule, BoardModule],
  controllers: [WhiteboardController],
  providers: [
    WhiteboardObjectsService,
    WhiteboardObjectsMutationService,
    WhiteboardObjectsQueryService,
    WhiteboardSnapshotsService,
    WhiteboardHistoryService,
  ],
  exports: [WhiteboardObjectsService, WhiteboardHistoryService],
})
export class WhiteboardModule {}
