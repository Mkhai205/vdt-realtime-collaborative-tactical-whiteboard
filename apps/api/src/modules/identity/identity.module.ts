import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { GuestIdentityGuard } from "./guest-identity.guard"
import { IdentityService } from "./identity.service"

@Module({
  imports: [DatabaseModule],
  providers: [IdentityService, GuestIdentityGuard],
  exports: [IdentityService, GuestIdentityGuard],
})
export class IdentityModule {}
