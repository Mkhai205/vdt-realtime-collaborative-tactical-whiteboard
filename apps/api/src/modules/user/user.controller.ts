import { Controller, Get, Patch } from "@nestjs/common"
import {
  type UserSummary,
  type UpdateProfileRequest,
  type JwtPayload,
  updateProfileRequestSchema,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodBody } from "../../common/pipes/zod-validation.pipe"
import { UserService } from "./user.service"

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@CurrentUser() currentUser: JwtPayload): Promise<UserSummary> {
    return this.userService.getProfile(currentUser.sub)
  }

  @Patch("me")
  async updateProfile(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(updateProfileRequestSchema) body: UpdateProfileRequest,
  ): Promise<UserSummary> {
    return this.userService.updateProfile(currentUser.sub, body)
  }
}
