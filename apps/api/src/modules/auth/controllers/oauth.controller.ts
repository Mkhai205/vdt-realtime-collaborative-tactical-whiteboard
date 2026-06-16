import { Controller, Get, Query, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import {
  googleOAuthStateCookieMaxAgeMs,
  googleOAuthStateCookieName,
  OAuthCallbackError,
  OAuthService,
} from "../services/oauth.service"

const stateCookieOptions = {
  httpOnly: true,
  maxAge: googleOAuthStateCookieMaxAgeMs,
  path: "/",
  sameSite: "lax" as const,
}

@Controller("auth")
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get("google")
  googleLogin(@Res() response: Response): void {
    const { state, url } = this.oauthService.createGoogleAuthRedirect()

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
      const redirectUrl = await this.oauthService.completeGoogleCallback(
        query,
        request.headers.cookie,
      )

      response.clearCookie(googleOAuthStateCookieName, stateCookieOptions)
      response.redirect(redirectUrl)
    } catch (error) {
      response.clearCookie(googleOAuthStateCookieName, stateCookieOptions)

      if (error instanceof OAuthCallbackError) {
        response.redirect(this.oauthService.buildFailureRedirect(error.reason))
        return
      }

      throw error
    }
  }
}
