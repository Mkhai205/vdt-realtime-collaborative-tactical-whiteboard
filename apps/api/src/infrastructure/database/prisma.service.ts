import { Injectable, OnModuleDestroy } from "@nestjs/common"
import { prisma, type PrismaClient } from "@rctw/database"

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = prisma

  async onModuleDestroy() {
    await this.client.$disconnect()
  }
}
