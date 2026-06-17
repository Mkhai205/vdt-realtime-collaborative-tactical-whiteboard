import { Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import {
  GuestIdentity,
  identityTypes,
  jwtIdentityPayloadSchema,
  UserSummary,
} from "@rctw/shared-contracts"
import { OAuth2Client } from "google-auth-library"
import { randomBytes } from "node:crypto"
import { z } from "zod"
import { FRONTEND_REDIRECT_URI_CONFIG_KEY, JWT_CONFIG_KEY } from "../../config"
import { PrismaService } from "../../infrastructure/database"

export const googleOAuthStateCookieName = "rctw_google_oauth_state"
export const googleOAuthStateCookieMaxAgeMs = 5 * 60 * 1000

const googleOAuthScopes = ["openid", "email", "profile"] as const

const googleCallbackQuerySchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
})

const avatarPalette = [
  "#3B82F6",
  "#16A34A",
  "#DC2626",
  "#D97706",
  "#7C3AED",
  "#0891B2",
  "#BE123C",
  "#4F46E5",
] as const

type OAuthRuntimeConfig = {
  clientId: string
  clientSecret: string
  callbackUrl: string
  jwtAccessSecret: string
  jwtAccessExpiresInSeconds: number
  successRedirect: string
  failureRedirect: string
}

type GoogleProfile = {
  email: string
  name: string
  avatarUrl: string | null
}

type OAuthCallbackReason =
  | "missing_code"
  | "missing_state"
  | "invalid_state"
  | "missing_id_token"
  | "google_verification_failed"
  | "unverified_email"
  | "invalid_profile"

export class OAuthCallbackError extends Error {
  constructor(readonly reason: OAuthCallbackReason) {
    super(reason)
  }
}

const userSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  avatarColor: true,
} as const

export type OAuthUserRecord = {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
  avatarColor: string
  identityType: string
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  createGoogleAuthRedirect(): { state: string; url: string } {
    const config = this.getRuntimeConfigOrThrow()
    const state = randomBytes(32).toString("base64url")
    const client = this.createOAuthClient(config)
    const url = client.generateAuthUrl({
      access_type: "online",
      prompt: "select_account",
      scope: [...googleOAuthScopes],
      state,
    })

    return { state, url }
  }

  async completeGoogleCallback(
    rawQuery: unknown,
    cookieHeader: string | undefined,
  ): Promise<string> {
    const config = this.getRuntimeConfigOrThrow()
    const query = this.parseCallbackQuery(rawQuery)
    const cookieState = this.readCookie(
      cookieHeader,
      googleOAuthStateCookieName,
    )

    if (!cookieState || cookieState !== query.state) {
      throw new OAuthCallbackError("invalid_state")
    }

    const profile = await this.verifyGoogleCode(query.code, config)
    const avatarColorRecord = await this.findAvatarColorByEmail(profile.email)
    const user = await this.upsertGoogleUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      avatarColor:
        avatarColorRecord?.avatarColor ??
        this.generateAvatarColor(profile.email),
    })
    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email ?? profile.email,
      name: user.name,
      identityType: "GOOGLE",
      avatarUrl: user.avatarUrl,
      avatarColor: user.avatarColor,
    })

    return this.buildSuccessRedirect(accessToken, config)
  }

  buildFailureRedirect(reason: string): string {
    const config = this.getRuntimeConfigOrThrow()
    const url = new URL(config.failureRedirect)
    url.searchParams.set("reason", reason)

    return url.toString()
  }

  private parseCallbackQuery(
    rawQuery: unknown,
  ): z.infer<typeof googleCallbackQuerySchema> {
    const query = rawQuery && typeof rawQuery === "object" ? rawQuery : {}
    const record = query as Record<string, unknown>

    if (!this.isNonEmptyString(record.code)) {
      throw new OAuthCallbackError("missing_code")
    }

    if (!this.isNonEmptyString(record.state)) {
      throw new OAuthCallbackError("missing_state")
    }

    return googleCallbackQuerySchema.parse({
      code: record.code,
      state: record.state,
    })
  }

  private async verifyGoogleCode(
    code: string,
    config: OAuthRuntimeConfig,
  ): Promise<GoogleProfile> {
    const client = this.createOAuthClient(config)

    try {
      const { tokens } = await client.getToken(code)

      if (!tokens.id_token) {
        throw new OAuthCallbackError("missing_id_token")
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId,
      })
      const payload = ticket.getPayload()

      if (!payload?.email) {
        throw new OAuthCallbackError("invalid_profile")
      }

      if (payload.email_verified !== true) {
        throw new OAuthCallbackError("unverified_email")
      }

      return {
        email: payload.email,
        name: payload.name?.trim() || payload.email,
        avatarUrl: payload.picture ?? null,
      }
    } catch (error) {
      if (error instanceof OAuthCallbackError) {
        throw error
      }

      throw new OAuthCallbackError("google_verification_failed")
    }
  }

  private async signAccessToken(
    rawPayload: z.input<typeof jwtIdentityPayloadSchema>,
  ): Promise<string> {
    const config = this.getRuntimeConfigOrThrow()
    const payload = jwtIdentityPayloadSchema.parse(rawPayload)

    return this.jwtService.signAsync(payload, {
      secret: config.jwtAccessSecret,
      expiresIn: config.jwtAccessExpiresInSeconds,
    })
  }

  private buildSuccessRedirect(
    accessToken: string,
    config: OAuthRuntimeConfig,
  ): string {
    const url = new URL(config.successRedirect)
    url.hash = new URLSearchParams({ accessToken }).toString()

    return url.toString()
  }

  private createOAuthClient(config: OAuthRuntimeConfig): OAuth2Client {
    return new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.callbackUrl,
    )
  }

  private getRuntimeConfigOrThrow(): OAuthRuntimeConfig {
    const clientId = this.readConfigString("GOOGLE_CLIENT_ID")
    const clientSecret = this.readConfigString("GOOGLE_CLIENT_SECRET")
    const callbackUrl = this.readConfigString("GOOGLE_CALLBACK_URL")
    const jwtAccessSecret = this.readConfigString("JWT_ACCESS_SECRET")

    if (!clientId || !clientSecret || !callbackUrl || !jwtAccessSecret) {
      throw new ServiceUnavailableException({
        code: "INTERNAL_ERROR",
        message:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, and JWT_ACCESS_SECRET.",
      })
    }

    return {
      clientId,
      clientSecret,
      callbackUrl,
      jwtAccessSecret,
      jwtAccessExpiresInSeconds:
        this.configService.get<number>("JWT_ACCESS_EXPIRES_IN_SECONDS") ??
        JWT_CONFIG_KEY.JWT_ACCESS_EXPIRES_IN_SECONDS,
      successRedirect:
        this.readConfigString("FRONTEND_LOGIN_SUCCESS_REDIRECT") ??
        FRONTEND_REDIRECT_URI_CONFIG_KEY.FRONTEND_LOGIN_SUCCESS_REDIRECT,
      failureRedirect:
        this.readConfigString("FRONTEND_LOGIN_FAILURE_REDIRECT") ??
        FRONTEND_REDIRECT_URI_CONFIG_KEY.FRONTEND_LOGIN_FAILURE_REDIRECT,
    }
  }

  private readConfigString(key: string): string | undefined {
    const value = this.configService.get<unknown>(key)

    if (typeof value !== "string") {
      return undefined
    }

    const normalized = value.trim()

    if (
      !normalized ||
      normalized.toLowerCase() === "undefined" ||
      normalized.toLowerCase() === "null"
    ) {
      return undefined
    }

    return normalized
  }

  private readCookie(header: string | undefined, name: string): string | null {
    if (!header) {
      return null
    }

    const cookie = header
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))

    if (!cookie) {
      return null
    }

    return decodeURIComponent(cookie.slice(name.length + 1))
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0
  }

  async findById(id: string): Promise<UserSummary | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSummarySelect,
    })
  }

  async findIdentityType(id: string): Promise<{ identityType: string } | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { identityType: true },
    })
  }

  async upsertGuest(identity: GuestIdentity): Promise<UserSummary> {
    return this.prisma.user.upsert({
      where: { id: identity.id },
      create: {
        id: identity.id,
        name: identity.name,
        avatarColor: identity.avatarColor,
        identityType: identityTypes.GUEST,
      },
      update: {
        name: identity.name,
        avatarColor: identity.avatarColor,
      },
      select: userSummarySelect,
    })
  }

  async findAvatarColorByEmail(
    email: string,
  ): Promise<{ avatarColor: string } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { avatarColor: true },
    })
  }

  async upsertGoogleUser(profile: {
    email: string
    name: string
    avatarUrl: string | null
    avatarColor: string
  }): Promise<OAuthUserRecord> {
    return this.prisma.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        avatarColor: profile.avatarColor,
        identityType: identityTypes.GOOGLE,
      },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        identityType: identityTypes.GOOGLE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        avatarColor: true,
        identityType: true,
      },
    })
  }

  private generateAvatarColor(seed: string): string {
    let hash = 0

    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
    }

    return avatarPalette[hash % avatarPalette.length] ?? avatarPalette[0]
  }
}
