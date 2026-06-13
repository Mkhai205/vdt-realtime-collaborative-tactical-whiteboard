import { Module } from "@nestjs/common"
import { IdentityModule } from "../identity"
import { RoomsModule } from "../rooms"
import { WhiteboardOperationsController } from "./whiteboard-operations.controller"
import { WhiteboardObjectsMutationService } from "./whiteboard-objects-mutation.service"
import { WhiteboardObjectsQueryService } from "./whiteboard-objects-query.service"
import { WhiteboardObjectsController } from "./whiteboard-objects.controller"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Module({
  imports: [IdentityModule, RoomsModule],
  controllers: [WhiteboardObjectsController, WhiteboardOperationsController],
  providers: [
    WhiteboardObjectsService,
    WhiteboardObjectsQueryService,
    WhiteboardObjectsMutationService,
  ],
  exports: [WhiteboardObjectsService],
})
export class WhiteboardObjectsModule {}
