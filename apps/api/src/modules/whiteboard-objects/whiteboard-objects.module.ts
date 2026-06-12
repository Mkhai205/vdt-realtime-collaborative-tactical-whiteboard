import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { IdentityModule } from "../identity"
import { RoomsModule } from "../rooms"
import { WhiteboardOperationsController } from "./whiteboard-operations.controller"
import { WhiteboardObjectsController } from "./whiteboard-objects.controller"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Module({
  imports: [DatabaseModule, IdentityModule, RoomsModule],
  controllers: [WhiteboardObjectsController, WhiteboardOperationsController],
  providers: [WhiteboardObjectsService],
  exports: [WhiteboardObjectsService],
})
export class WhiteboardObjectsModule {}
