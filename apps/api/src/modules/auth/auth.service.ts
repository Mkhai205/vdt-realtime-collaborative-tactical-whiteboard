import { Injectable } from "@nestjs/common"
import {
  avatarPalette,
  identityTypes,
  JwtPayload,
  type UserSummary,
} from "@rctw/shared-contracts"
import * as crypto from "node:crypto"
import { PrismaService } from "../../infrastructure/database"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import { unauthenticated } from "../../common/utils/error"
import { OAuth2Client } from "google-auth-library"
import { userSummarySelect } from "../user/user.service"

export const REFRESH_TOKEN_EXPIRES = 30 * 24 * 60 * 60 * 10000 // 30 days
export const JWT_ACCESS_EXPIRES = 15 * 60 * 1000 // 15 minutes

@Injectable()
export class AuthService {
  private readonly oauthClient: OAuth2Client

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.oauthClient = new OAuth2Client(
      this.configService.getOrThrow("GOOGLE_CLIENT_ID"),
    )
  }

  async registerGuest(): Promise<{
    accessToken: string
    refreshToken: string
    user: UserSummary
  }> {
    const guestName = this.generateName()
    const guestAvatarColor = this.generateAvatarColor()

    const guest = await this.prisma.user.create({
      data: {
        name: guestName,
        avatarColor: guestAvatarColor,
        identityType: identityTypes.GUEST,
        lastSeenAt: new Date(),
      },
      select: userSummarySelect,
    })

    const accessToken = await this.createAccessToken({
      sub: guest.id,
      name: guest.name,
      email: guest.email,
      identityType: guest.identityType,
    })

    const refreshToken = await this.createRefreshToken(guest.id)

    return { accessToken, refreshToken, user: guest }
  }

  async createRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString("hex")
    const tokenHash = this.createHashToken(rawToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES) // 30 days

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    })

    return rawToken
  }

  async rotateRefreshToken(rawToken: string): Promise<{
    accessToken: string
    newRefreshToken: string
    user: UserSummary
  }> {
    const tokenHash = this.createHashToken(rawToken)

    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: userSummarySelect } },
    })

    if (!existingToken) {
      throw unauthenticated("Invalid refresh token.")
    }

    if (existingToken.expiresAt < new Date() || existingToken.revokedAt) {
      // Security measure: revoke all tokens for this user if reuse is detected
      await this.prisma.refreshToken.deleteMany({
        where: { userId: existingToken.userId },
      })
      throw unauthenticated("Refresh token has expired or been revoked.")
    }

    // Delete/rotate the old one
    await this.prisma.refreshToken.delete({
      where: { id: existingToken.id },
    })

    // Create a new one
    const newRefreshToken = await this.createRefreshToken(existingToken.user.id)
    const accessToken = await this.createAccessToken({
      sub: existingToken.user.id,
      name: existingToken.user.name,
      email: existingToken.user.email,
      identityType: existingToken.user.identityType,
    })

    return { accessToken, newRefreshToken, user: existingToken.user }
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.createHashToken(rawToken)
    try {
      await this.prisma.refreshToken.delete({
        where: { tokenHash },
      })
    } catch {
      // Suppress missing token errors on double logout
    }
  }

  async updateLastSeen(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    })
  }

  async loginWithGoogle(
    idToken: string,
    guestUserId?: string | null,
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: UserSummary
  }> {
    const googlePayload = await this.verifyGoogleIdToken(idToken)
    const now = new Date()

    let user = await this.prisma.user.findUnique({
      where: { googleId: googlePayload.sub },
    })

    if (guestUserId) {
      // Try to upgrade guest user
      const guestUser = await this.prisma.user.findUnique({
        where: { id: guestUserId },
      })

      if (guestUser && guestUser.identityType === identityTypes.GUEST) {
        user = await this.prisma.user.update({
          where: { id: guestUserId },
          data: {
            identityType: identityTypes.GOOGLE,
            googleId: googlePayload.sub,
            email: googlePayload.email,
            name: googlePayload.name || guestUser.name,
            avatarUrl: googlePayload.picture || guestUser.avatarUrl,
            lastSeenAt: new Date(),
          },
        })
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId: googlePayload.sub,
          email: googlePayload.email,
          name: googlePayload.name!,
          avatarUrl: googlePayload.picture,
          avatarColor: this.generateAvatarColor(),
          identityType: identityTypes.GOOGLE,
          lastSeenAt: now,
        },
      })
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: googlePayload.picture || user.avatarUrl,
          lastSeenAt: now,
        },
      })
    }

    const userSummary: UserSummary = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      avatarColor: user.avatarColor,
      identityType: user.identityType,
      lastSeenAt: user.lastSeenAt,
    }

    const accessToken = await this.createAccessToken({
      sub: user.id,
      name: user.name,
      email: user.email,
      identityType: user.identityType,
    })

    const refreshToken = await this.createRefreshToken(user.id)

    return { accessToken, refreshToken, user: userSummary }
  }

  // Helper

  async createAccessToken(payload: JwtPayload): Promise<string> {
    const jwtAccessSecret =
      this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")

    return this.jwtService.signAsync(payload, {
      secret: jwtAccessSecret,
      expiresIn: JWT_ACCESS_EXPIRES,
    })
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const jwtAccessSecret =
      this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    const payload = await this.jwtService.verifyAsync(token, {
      secret: jwtAccessSecret,
    })

    return payload
  }

  getBearerToken(authorizationHeader: string): string {
    const [type, token] = authorizationHeader.split(" ")

    if (type !== "Bearer" || !token) {
      throw unauthenticated("Invalid authorization header format.")
    }

    return token
  }

  private async verifyGoogleIdToken(idToken: string): Promise<{
    sub: string
    email?: string
    name?: string
    picture?: string
  }> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
      })
      const payload = ticket.getPayload()
      if (!payload) {
        throw unauthenticated("Invalid Google ID token payload.")
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      }
    } catch (e: any) {
      throw unauthenticated(`Google token verification failed: ${e.message}`)
    }
  }

  private createHashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex")
  }

  private generateName() {
    return `Guest_${Math.floor(1000 + Math.random() * 9000)}`
  }

  private generateAvatarColor() {
    return (
      avatarPalette[Math.floor(Math.random() * avatarPalette.length)] ??
      "#3B82F6"
    )
  }
}
