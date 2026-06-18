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

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  avatarColor: true,
  identityType: true,
  lastSeenAt: true,
} as const

export const REFRESH_TOKEN_EXPIRES = 30 * 24 * 60 * 60 * 10000 // 30 days
export const JWT_ACCESS_EXPIRES = 15 * 60 * 1000 // 15 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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
      id: guest.id,
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
      id: existingToken.user.id,
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
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      })
    } catch {
      // Fail silently to not impact request performance
    }
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
