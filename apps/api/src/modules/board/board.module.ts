import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { PermissionModule } from "../permission/permission.module"
import { BoardController } from "./controllers/board.controller"
import { BoardService } from "./services/board.service"

@Module({
  imports: [AuthModule, PermissionModule],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardModule {}
