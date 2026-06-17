import { Controller, Get } from "@nestjs/common"
import type { UserSummary } from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { UserService } from "./user.service"

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@CurrentUser() currentUser: UserSummary): Promise<UserSummary> {
    return this.userService.getProfile(currentUser.id)
  }
}
