import { Module } from "@nestjs/common"
import { UserController } from "./user.controller"
import { UserService } from "./user.service"
import { UserCleanupService } from "./user-cleanup.service"

@Module({
  controllers: [UserController],
  providers: [UserService, UserCleanupService],
  exports: [UserService],
})
export class UserModule {}
