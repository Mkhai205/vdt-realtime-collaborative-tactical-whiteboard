import { Controller, Post, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import {
  loginGoogleSchema,
  type LoginGoogleRequest,
  type LoginResponse,
  type RefreshResponse,
} from "@rctw/shared-contracts"
import { AuthService, REFRESH_TOKEN_EXPIRES } from "./auth.service"
import { Public } from "../../common/decorators/public.decorator"
import { unauthenticated } from "./auth.utils"
import { ConfigService } from "@nestjs/config"
import { ZodBody } from "../../common/pipes"

const refreshCookieName = "rctw_refresh_token"

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post("google")
  async googleLogin(
    @ZodBody(loginGoogleSchema) body: LoginGoogleRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const { accessToken, refreshToken, user } =
      await this.authService.loginWithGoogle(body.idToken)

    this.setRefreshTokenCookie(response, refreshToken)

    return { accessToken, user }
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponse> {
    const refreshToken = this.getRefreshTokenFromCookie(request)

    const { accessToken, newRefreshToken, user } =
      await this.authService.rotateRefreshToken(refreshToken)

    this.setRefreshTokenCookie(response, newRefreshToken)

    return { accessToken, user }
  }

  @Public()
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[refreshCookieName] as
      | string
      | undefined
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken)
    }
    response.clearCookie(refreshCookieName)
  }

  // --- Helper ---

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
    response.cookie(refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: this.configService.get("NODE_ENV") === "production",
      sameSite: "lax" as const,
      maxAge: REFRESH_TOKEN_EXPIRES,
      path: "/",
    })
  }
}
