import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ApiExceptionFilter } from "./common/filters"
import { ConfigService } from "@nestjs/config"
import { Logger } from "@nestjs/common"
import { LoggingInterceptor } from "./common/interceptors"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const logger = new Logger("Bootstrap")

  const globalPrefix = "api/v1"
  app.setGlobalPrefix(globalPrefix)

  const corsOrigins = configService.get<string[]>("CORS_ORIGIN")
  app.enableCors({
    credentials: true,
    origin: corsOrigins,
  })

  app.useGlobalFilters(new ApiExceptionFilter())

  app.useGlobalInterceptors(new LoggingInterceptor())

  const port = configService.get<number>("PORT")!
  await app.listen(port)
  logger.log(`Backend API running on http://localhost:${port}/${globalPrefix}`)
}
void bootstrap()
