import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { BoardModule } from "../board/board.module"
import { WhiteboardModule } from "../whiteboard/whiteboard.module"
import {
  BoardSessionHandler,
  CollaborationHandler,
  WhiteboardMutationHandler,
} from "./handlers"
import { CollaborationGateway } from "./gateways/collaboration.gateway"
import { PresenceService } from "./presence.service"

@Module({
  imports: [AuthModule, BoardModule, WhiteboardModule],
  providers: [
    CollaborationGateway,
    BoardSessionHandler,
    WhiteboardMutationHandler,
    CollaborationHandler,
    PresenceService,
  ],
})
export class CollaborationModule {}
