import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ConfigModule } from "@nestjs/config"
import { validateEnv } from "./config"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      cache: true,
      validate: validateEnv,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
