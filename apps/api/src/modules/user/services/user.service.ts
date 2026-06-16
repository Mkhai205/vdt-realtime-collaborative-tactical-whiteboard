import { Injectable, NotFoundException } from "@nestjs/common"
import type { UserSummary } from "@rctw/shared-contracts"
import { UserRepository } from "../repositories/user.repository"

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<UserSummary> {
    const user = await this.userRepository.findProfile(userId)

    if (!user) {
      throw new NotFoundException({
        code: "BOARD_NOT_FOUND",
        message: "User not found.",
      })
    }

    return user
  }
}
