import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { BoardModule } from "../board/board.module"
import { WhiteboardModule } from "../whiteboard"
import { PresenceModule } from "../presence"
import { HistoryModule } from "../history"
import {
  BoardSessionHandler,
  CollaborationHandler,
  WhiteboardMutationHandler,
} from "./handlers"
import { CollaborationGateway } from "./gateways/collaboration.gateway"

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

