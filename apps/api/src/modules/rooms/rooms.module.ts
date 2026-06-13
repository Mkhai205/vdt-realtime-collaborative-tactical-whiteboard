import { Module } from "@nestjs/common"
import { IdentityModule } from "../identity"
import { RoomsController } from "./rooms.controller"
import { RoomsPermissionService } from "./rooms-permission.service"
import { RoomsService } from "./rooms.service"

@Module({
  imports: [IdentityModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsPermissionService],
  exports: [RoomsService, RoomsPermissionService],
})
export class RoomsModule {}
