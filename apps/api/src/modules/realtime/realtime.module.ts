import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { BoardModule } from "../board/board.module"
import { WhiteboardObjectsModule } from "../whiteboard-objects"
import { PresenceService } from "./presence.service"
import { RealtimeGateway } from "./realtime.gateway"

@Module({
  imports: [AuthModule, BoardModule, WhiteboardObjectsModule],
  providers: [RealtimeGateway, PresenceService],
  exports: [PresenceService],
})
export class RealtimeModule {}
