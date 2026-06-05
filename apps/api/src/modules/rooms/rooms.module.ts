import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { IdentityModule } from "../identity"
import { RoomsController } from "./rooms.controller"
import { RoomsService } from "./rooms.service"

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
