import { Injectable } from "@nestjs/common"
import {
  type UserSummary,
  type UpdateProfileRequest,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { AppException } from "../../common/exceptions"

export const userSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  avatarColor: true,
} as const

export const userProfileSelect = {
  ...userSummarySelect,
  email: true,
} as const

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    })

    if (!user) {
      throw AppException.userNotFound()
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
      throw AppException.userNotFound()
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        avatarColor: data.avatarColor,
      },
      select: userSummarySelect,
    })
  }
}
