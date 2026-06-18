import { Injectable, NotFoundException } from "@nestjs/common"
import { apiErrorCodes, type UserSummary, type UpdateProfileRequest } from "@rctw/shared-contracts"
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

  async updateProfile(
    userId: string,
    data: UpdateProfileRequest,
  ): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException({
        code: apiErrorCodes.USER_NOT_FOUND,
        message: "User not found.",
      })
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name ?? undefined,
        avatarColor: data.avatarColor ?? undefined,
        lastSeenAt: new Date(),
      },
      select: userSummarySelect,
    })
  }
}
