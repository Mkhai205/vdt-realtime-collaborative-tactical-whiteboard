import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { JwtModule } from "@nestjs/jwt"
import { AuthController } from "./auth.controller"
import { AuthGuard } from "./guards/auth.guard"
import { AuthService } from "./auth.service"

@Module({
  imports: [JwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
