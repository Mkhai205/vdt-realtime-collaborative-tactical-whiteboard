import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { validateEnv } from "./config"
import { DatabaseModule } from "./infrastructure/database"
import { MailModule } from "./infrastructure/mail"
import { AuthModule } from "./modules/auth/auth.module"
import { BoardModule } from "./modules/board/board.module"
import { WhiteboardModule } from "./modules/whiteboard/whiteboard.module"
import { CollaborationModule } from "./modules/collaboration/collaboration.module"
import { UserModule } from "./modules/user/user.module"

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
    AuthModule,
    BoardModule,
    WhiteboardModule,
    CollaborationModule,
    UserModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
