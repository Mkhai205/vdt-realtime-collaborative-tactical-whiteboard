import { Controller, Get, Patch } from "@nestjs/common"
import {
  updateProfileRequestSchema,
  type UpdateProfileRequest,
  type JwtPayload,
  type UserResponse,
  type UpdateProfileResponse,
} from "@rctw/shared-contracts"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { ZodBody } from "../../common/pipes/zod-validation.pipe"
import { UserService } from "./user.service"
import { AuthService } from "../auth/auth.service"

@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get("me")
  async getMe(@CurrentUser() currentUser: JwtPayload): Promise<UserResponse> {
    return this.userService.getProfile(currentUser.sub)
  }

  @Patch("me")
  async updateProfile(
    @CurrentUser() currentUser: JwtPayload,
    @ZodBody(updateProfileRequestSchema) body: UpdateProfileRequest,
  ): Promise<UpdateProfileResponse> {
    const user = await this.userService.updateProfile(currentUser.sub, body)
    const accessToken = await this.authService.createAccessToken(currentUser)
    return { user, accessToken }
  }
}
