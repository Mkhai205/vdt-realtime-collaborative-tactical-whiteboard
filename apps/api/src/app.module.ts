import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ConfigModule } from "@nestjs/config"
import { validateEnv } from "./config"
import { IdentityModule } from "./modules/identity/identity.module"
import { RoomsModule } from "./modules/rooms"
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
    DatabaseModule,
    IdentityModule,
    RoomsModule,
    WhiteboardObjectsModule,
    WhiteboardSnapshotsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
