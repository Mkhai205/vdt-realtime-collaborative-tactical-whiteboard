import { Controller, Get, Post, Query, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { type UserSummary } from "@rctw/shared-contracts"
import { AuthService } from "./auth.service"
import {
  googleOAuthStateCookieMaxAgeMs,
  googleOAuthStateCookieName,
  OAuthCallbackError,
  GoogleOAuthService,
} from "./google-oauth.service"

const stateCookieOptions = {
  httpOnly: true,
  maxAge: googleOAuthStateCookieMaxAgeMs,
  path: "/",
  sameSite: "lax" as const,
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly authService: AuthService,
  ) {}

  @Post("guest")
  async registerGuest(): Promise<{ accessToken: string; user: UserSummary }> {
    return this.authService.registerGuest()
  }

  @Get("google")
  googleLogin(@Res() response: Response): void {
    const { state, url } = this.googleOAuthService.createGoogleAuthRedirect()

    response.cookie(googleOAuthStateCookieName, state, stateCookieOptions)
    response.redirect(url)
  }

  @Get("google/callback")
  async googleCallback(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const redirectUrl = await this.googleOAuthService.completeGoogleCallback(
        query,
        request.headers.cookie,
      )

      response.clearCookie(googleOAuthStateCookieName, stateCookieOptions)
      response.redirect(redirectUrl)
    } catch (error) {
      response.clearCookie(googleOAuthStateCookieName, stateCookieOptions)

      if (error instanceof OAuthCallbackError) {
        response.redirect(
          this.googleOAuthService.buildFailureRedirect(error.reason),
        )
        return
      }

      throw error
    }
  }
}
