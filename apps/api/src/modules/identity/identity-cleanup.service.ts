import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { PrismaService } from "../../infrastructure/database"

@Injectable()
export class IdentityCleanupService {
  private readonly logger = new Logger(IdentityCleanupService.name)

  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredGuests() {
    this.logger.log("Starting cleanup of expired guest accounts...")

    const threshold = new Date()
    threshold.setHours(threshold.getHours() - 48)

    try {
      const { count } = await this.prismaService.user.deleteMany({
        where: {
          identityType: "GUEST",
          updatedAt: {
            lt: threshold,
          },
        },
      })

      this.logger.log(`Successfully deleted ${count} expired guest accounts.`)
    } catch (error) {
      this.logger.error("Failed to clean up expired guest accounts", error)
    }
  }
}
