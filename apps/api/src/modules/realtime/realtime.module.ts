import { Module } from "@nestjs/common"
import { IdentityModule } from "../identity"
import { RoomsModule } from "../rooms"
import { WhiteboardObjectsModule } from "../whiteboard-objects"
import { PresenceService } from "./presence.service"
import { RealtimeGateway } from "./realtime.gateway"

@Module({
  imports: [IdentityModule, RoomsModule, WhiteboardObjectsModule],
  providers: [RealtimeGateway, PresenceService],
  exports: [PresenceService],
})
export class RealtimeModule {}
