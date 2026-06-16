import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ConfigModule } from "@nestjs/config"
import { ScheduleModule } from "@nestjs/schedule"
import { validateEnv } from "./config"
import { AuthModule } from "./modules/auth"
import { UserModule } from "./modules/user"
import { PermissionModule } from "./modules/permission"
import { BoardModule } from "./modules/board"
import { PresenceModule } from "./modules/presence"
import { HistoryModule } from "./modules/history"
import { WhiteboardModule } from "./modules/whiteboard"
import { CollaborationModule } from "./modules/collaboration"
import { DatabaseModule } from "./infrastructure/database"

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
