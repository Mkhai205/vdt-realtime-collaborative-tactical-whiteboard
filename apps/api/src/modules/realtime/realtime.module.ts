import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { BoardModule } from "../board/board.module"
import { RedisModule } from "../../infrastructure/redis/redis.module"
import { BoardGateway } from "./gateways/board.gateway"
import { WsAuthGuard } from "./guards/ws-auth.guard"
import { PresenceService } from "./services/presence.service"
import {
  BoardHandler,
  ObjectHandler,
  OperationHandler,
  CursorHandler,
  PresenceHandler,
  SelectionHandler,
  LaserHandler,
} from "./handlers"

@Module({
  imports: [AuthModule, BoardModule, RedisModule],
  providers: [
    BoardGateway,
    WsAuthGuard,
    PresenceService,
    // Handlers
    BoardHandler,
    ObjectHandler,
    OperationHandler,
    CursorHandler,
    PresenceHandler,
    SelectionHandler,
    LaserHandler,
  ],
  exports: [PresenceService],
})
export class RealtimeModule {}
