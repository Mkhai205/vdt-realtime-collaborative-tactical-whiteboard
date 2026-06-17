import { Controller, Get, UseGuards } from "@nestjs/common"
import type { UserSummary } from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { AuthGuard } from "../auth/guards/auth.guard"
import { UserService } from "./user.service"

@Controller("users")
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@CurrentUser() currentUser: UserSummary): Promise<UserSummary> {
    return this.userService.getProfile(currentUser.id)
  }
}
