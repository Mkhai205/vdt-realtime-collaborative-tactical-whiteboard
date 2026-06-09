import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { IdentityModule } from "../identity"
import { RoomsModule } from "../rooms"
import { WhiteboardObjectsController } from "./whiteboard-objects.controller"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Module({
  imports: [DatabaseModule, IdentityModule, RoomsModule],
  controllers: [WhiteboardObjectsController],
  providers: [WhiteboardObjectsService],
  exports: [WhiteboardObjectsService],
})
export class WhiteboardObjectsModule {}
