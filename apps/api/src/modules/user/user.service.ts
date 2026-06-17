import { Injectable, NotFoundException } from "@nestjs/common"
import { apiErrorCodes, type UserSummary } from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"

const userSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  avatarColor: true,
  identityType: true,
} as const

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSummarySelect,
    })

    if (!user) {
      throw new NotFoundException({
        code: apiErrorCodes.USER_NOT_FOUND,
        message: "User not found.",
      })
    }

    return user
  }
}
