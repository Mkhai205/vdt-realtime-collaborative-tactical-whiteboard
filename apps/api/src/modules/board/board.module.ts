import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { BoardController } from "./board.controller"
import { BoardPermissionService } from "./board-permission.service"
import { BoardService } from "./board.service"

@Module({
  imports: [AuthModule],
  controllers: [BoardController],
  providers: [BoardService, BoardPermissionService],
  exports: [BoardService, BoardPermissionService],
})
export class BoardModule {}
