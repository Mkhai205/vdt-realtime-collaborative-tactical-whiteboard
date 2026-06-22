/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createPrismaAdapter, PrismaClient } from "@rctw/database"

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  constructor(configService: ConfigService) {
    const adapter = createPrismaAdapter({
      connectionString: configService.getOrThrow<string>("DATABASE_URL"),
    })

    super({
      adapter,
      log: [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
      ],
    })
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
    this.logger.log("🔌 Disconnected from PostgreSQL database")
  }

  private async connectWithRetry(): Promise<void> {
    const maxAttempts = 5

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect()
        this.logger.log("👌 Connected to PostgreSQL database via Prisma")
        return
      } catch (error) {
        const delay = attempt * 2000 // Linear backoff: 2s, 4s, 6s, 8s, 10s
        this.logger.warn(
          `🤌 Prisma connect attempt ${attempt}/${delay} failed: ${error}`,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error("☠️ Database connection failed")
  }
}
