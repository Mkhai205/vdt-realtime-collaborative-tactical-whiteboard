import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { PrismaService } from "../../infrastructure/database"
import { identityTypes } from "@rctw/shared-contracts"

@Injectable()
export class UserCleanupService {
  private readonly logger = new Logger(UserCleanupService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupGuestAccounts() {
    this.logger.log("Starting daily guest accounts cleanup...")
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    try {
      const deleteResult = await this.prisma.user.deleteMany({
        where: {
          identityType: identityTypes.GUEST,
          lastSeenAt: {
            lt: thirtyDaysAgo,
          },
          createdBoards: {
            none: {},
          },
          memberships: {
            none: {},
          },
          operations: {
            none: {},
          },
          objectsCreated: {
            none: {},
          },
          objectsUpdated: {
            none: {},
          },
        },
      })

      this.logger.log(
        `Guest account cleanup completed. Deleted ${deleteResult.count} inactive guest(s).`,
      )
    } catch (error) {
      this.logger.error("Error during guest account cleanup", error)
    }
  }
}
