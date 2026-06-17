import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { WhiteboardObjectsController } from "./controllers/whiteboard-objects.controller"
import { WhiteboardOperationsController } from "./controllers/whiteboard-operations.controller"
import { WhiteboardObjectsService } from "./services/whiteboard-objects.service"
import { WhiteboardObjectsQueryService } from "./services/whiteboard-objects-query.service"
import { WhiteboardObjectsMutationService } from "./services/whiteboard-objects-mutation.service"
import { WhiteboardSnapshotsService } from "./services/whiteboard-snapshots.service"
import { AuthModule } from "../auth/auth.module"
import { PermissionModule } from "../permission/permission.module"

@Module({
  imports: [DatabaseModule, AuthModule, PermissionModule],
  controllers: [WhiteboardObjectsController, WhiteboardOperationsController],
  providers: [
    WhiteboardObjectsService,
    WhiteboardObjectsQueryService,
    WhiteboardObjectsMutationService,
    WhiteboardSnapshotsService,
  ],
  exports: [WhiteboardObjectsService, WhiteboardSnapshotsService],
})
export class WhiteboardModule {}
