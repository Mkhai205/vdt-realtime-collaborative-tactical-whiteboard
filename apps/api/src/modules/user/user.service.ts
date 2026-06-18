import { Injectable } from "@nestjs/common"
import {
  type UserSummary,
  type UpdateProfileRequest,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { userNotFound } from "../../common/utils/error"

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  avatarColor: true,
  identityType: true,
  lastSeenAt: true,
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
      throw userNotFound()
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
      throw userNotFound()
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
