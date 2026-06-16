import { forwardRef, Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { UserController } from "./controllers/user.controller"
import { UserRepository } from "./repositories/user.repository"
import { UserService } from "./services/user.service"

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserRepository, UserService],
})
export class UserModule {}
