import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ConfigModule } from "@nestjs/config"
import { validateEnv } from "./config"
import { IdentityModule } from "./modules/identity/identity.module"
import { RoomsModule } from "./modules/rooms"
import { WhiteboardObjectsModule } from "./modules/whiteboard-objects"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      cache: true,
      validate: validateEnv,
    }),
    IdentityModule,
    RoomsModule,
    WhiteboardObjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
