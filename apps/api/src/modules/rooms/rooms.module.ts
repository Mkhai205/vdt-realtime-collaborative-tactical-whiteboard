import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { PermissionModule } from "../permission/permission.module"
import { RoomsController } from "./rooms.controller"
import { RoomsService } from "./rooms.service"

@Module({
  imports: [AuthModule, PermissionModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
