import { Controller, Post, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { type UserSummary } from "@rctw/shared-contracts"
import { AuthService, REFRESH_TOKEN_EXPIRES } from "./auth.service"
import { Public } from "../../common/decorators/public.decorator"
import { unauthenticated } from "../../common/utils/error"

const refreshCookieName = "rctw_refresh_token"
const refreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  maxAge: REFRESH_TOKEN_EXPIRES,
  path: "/",
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("guest")
  async registerGuest(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; user: UserSummary }> {
    const { accessToken, refreshToken, user } =
      await this.authService.registerGuest()

    this.setRefreshTokenCookie(response, refreshToken)

    return { accessToken, user }
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; user: UserSummary }> {
    const refreshToken = this.getRefreshTokenFromCookie(request)

    const { accessToken, newRefreshToken, user } =
      await this.authService.rotateRefreshToken(refreshToken)

    this.setRefreshTokenCookie(response, newRefreshToken)

    return { accessToken, user }
  }

  @Public()
  @Post("logout")
  async logout(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: boolean }> {
    response.clearCookie(refreshCookieName)

    return { success: true }
  }

  // Helper

  private getRefreshTokenFromCookie(request: Request): string {
    const token = request.cookies?.[refreshCookieName] as string | undefined
    if (!token) {
      throw unauthenticated("Missing refresh token.")
    }
    return token
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie(refreshCookieName, refreshToken, refreshCookieOptions)
  }
}
