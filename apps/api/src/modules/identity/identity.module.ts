import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { GuestIdentityGuard } from "./guest-identity.guard"
import { IdentityGuard } from "./identity.guard"
import { IdentityService } from "./identity.service"
import { OAuthController } from "./oauth.controller"
import { OAuthService } from "./oauth.service"

@Module({
  imports: [JwtModule],
  controllers: [OAuthController],
  providers: [IdentityService, IdentityGuard, GuestIdentityGuard, OAuthService],
  exports: [IdentityService, IdentityGuard, GuestIdentityGuard],
})
export class IdentityModule {}
