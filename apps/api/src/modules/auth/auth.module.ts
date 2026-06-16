import { forwardRef, Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { UserModule } from "../user/user.module"
import { OAuthController } from "./controllers/oauth.controller"
import { AuthGuard } from "./guards/auth.guard"
import { AuthService } from "./services/auth.service"
import { OAuthService } from "./services/oauth.service"

@Module({
  imports: [JwtModule, forwardRef(() => UserModule)],
  controllers: [OAuthController],
  providers: [AuthService, AuthGuard, OAuthService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
