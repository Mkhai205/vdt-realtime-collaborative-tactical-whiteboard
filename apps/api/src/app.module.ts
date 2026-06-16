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
import { WhiteboardSnapshotsModule } from "./modules/whiteboard-snapshots"
import { WhiteboardObjectsModule } from "./modules/whiteboard-objects"
import { RealtimeModule } from "./modules/realtime"
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
    WhiteboardObjectsModule,
    WhiteboardSnapshotsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
