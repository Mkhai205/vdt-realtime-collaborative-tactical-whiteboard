import { Module } from "@nestjs/common"
import { BoardController } from "./board.controller"
import { BoardPermissionService } from "./board-permission.service"
import { BoardService } from "./board.service"

@Module({
  controllers: [BoardController],
  providers: [BoardService, BoardPermissionService],
  exports: [BoardService, BoardPermissionService],
})
export class BoardModule {}
