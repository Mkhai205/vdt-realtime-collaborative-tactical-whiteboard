import { Controller, Get, Patch } from "@nestjs/common"
import {
  type UserSummary,
  updateProfileRequestSchema,
  type UpdateProfileRequest,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodBody } from "../../common/pipes/zod-validation.pipe"
import { UserService } from "./user.service"

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@CurrentUser() currentUser: UserSummary): Promise<UserSummary> {
    return this.userService.getProfile(currentUser.id)
  }

  @Patch("me")
  async updateProfile(
    @CurrentUser() currentUser: UserSummary,
    @ZodBody(updateProfileRequestSchema) body: UpdateProfileRequest,
  ): Promise<UserSummary> {
    return this.userService.updateProfile(currentUser.id, body)
  }
}
