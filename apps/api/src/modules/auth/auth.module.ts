import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { OAuthController } from "./oauth.controller"
import { AuthGuard } from "./guards/auth.guard"
import { AuthService } from "./auth.service"
import { OAuthService } from "./oauth.service"

@Module({
  imports: [JwtModule],
  controllers: [OAuthController],
  providers: [AuthService, AuthGuard, OAuthService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
