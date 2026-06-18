import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ConfigModule } from "@nestjs/config"
import { ScheduleModule } from "@nestjs/schedule"
import { validateEnv } from "./config"
import { DatabaseModule } from "./infrastructure/database"
import { MailModule } from "./infrastructure/mail/mail.module"
import { AuthModule } from "./modules/auth/auth.module"
import { PermissionModule } from "./modules/permission/permission.module"
import { PresenceModule } from "./modules/presence/presence.module"
import { HistoryModule } from "./modules/history/history.module"
import { CollaborationModule } from "./modules/collaboration/collaboration.module"
import { WhiteboardModule } from "./modules/whiteboard/whiteboard.module"
import { BoardModule } from "./modules/board/board.module"
import { UserModule } from "./modules/user/user.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    MailModule,
    AuthModule,
    UserModule,
    PermissionModule,
    BoardModule,
    PresenceModule,
    HistoryModule,
    WhiteboardModule,
    CollaborationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
