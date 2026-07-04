import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { validateEnv } from "./config"
import { DatabaseModule } from "./infrastructure/database"
import { MailModule } from "./infrastructure/mail"
import { AuthModule } from "./modules/auth/auth.module"
import { BoardModule } from "./modules/board/board.module"
import { UserModule } from "./modules/user/user.module"
import { RealtimeModule } from "./modules/realtime/realtime.module"
import { RedisModule } from "./infrastructure/redis/redis.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
      cache: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    MailModule,
    RedisModule,
    AuthModule,
    BoardModule,
    RealtimeModule,
    UserModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
