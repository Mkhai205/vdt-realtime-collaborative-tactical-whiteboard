import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { DatabaseModule } from "../../infrastructure/database"
import { GuestIdentityGuard } from "./guest-identity.guard"
import { IdentityGuard } from "./identity.guard"
import { IdentityService } from "./identity.service"
import { OAuthController } from "./oauth.controller"
import { OAuthService } from "./oauth.service"

@Module({
  imports: [DatabaseModule, JwtModule],
  controllers: [OAuthController],
  providers: [IdentityService, IdentityGuard, GuestIdentityGuard, OAuthService],
  exports: [IdentityService, IdentityGuard, GuestIdentityGuard],
})
export class IdentityModule {}
