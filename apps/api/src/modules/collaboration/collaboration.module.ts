import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { BoardModule } from "../board/board.module"
import {
  BoardSessionHandler,
  CollaborationHandler,
  WhiteboardMutationHandler,
} from "./handlers"
import { CollaborationGateway } from "./gateways/collaboration.gateway"
import { WhiteboardModule } from "../whiteboard/whiteboard.module"
import { PresenceModule } from "../presence/presence.module"
import { HistoryModule } from "../history/history.module"

@Module({
  imports: [
    AuthModule,
    BoardModule,
    WhiteboardModule,
    PresenceModule,
    HistoryModule,
  ],
  providers: [
    CollaborationGateway,
    BoardSessionHandler,
    WhiteboardMutationHandler,
    CollaborationHandler,
  ],
})
export class CollaborationModule {}
