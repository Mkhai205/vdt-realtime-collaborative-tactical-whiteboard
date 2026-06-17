import { Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import {
  apiErrorCodeSchema,
  authorizationHeaderName,
  identityTypes,
  jwtIdentityPayloadSchema,
  socketAuthPayloadSchema,
  type GuestIdentity,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"

type HeaderBag = Record<string, unknown>

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
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async registerGuest(
    identity: GuestIdentity,
  ): Promise<{ accessToken: string }> {
    const existingUser = await this.findIdentityType(identity.id)

    if (existingUser && existingUser.identityType !== "GUEST") {
      throw this.unauthenticated("Invalid guest identity.")
    }

    const guest = await this.upsertGuest(identity)
    const jwtSecret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    const expiresIn = this.configService.getOrThrow<number>(
      "JWT_ACCESS_EXPIRES_IN_SECONDS",
    )

    const accessToken = await this.jwtService.signAsync(
      {
        sub: guest.id,
        name: guest.name,
        avatarColor: guest.avatarColor,
        identityType: "GUEST",
      },
      {
        secret: jwtSecret,
        expiresIn,
      },
    )

    return { accessToken }
  }

  async resolveRestIdentity(headers: HeaderBag): Promise<UserSummary> {
    const bearerToken = this.readBearerToken(headers)

    if (bearerToken) {
      return this.resolveJwtIdentity(bearerToken)
    }

    throw this.unauthenticated()
  }

  async resolveSocketIdentity(payload: unknown): Promise<UserSummary> {
    const parsed = socketAuthPayloadSchema.safeParse(payload ?? {})

    if (!parsed.success || !parsed.data.token) {
      throw this.unauthenticated()
    }

    return this.resolveJwtIdentity(parsed.data.token)
  }

  async resolveJwtIdentity(token: string): Promise<UserSummary> {
    const jwtSecret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")

    let decodedPayload: unknown

    try {
      decodedPayload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, {
        secret: jwtSecret,
      })
    } catch {
      throw this.unauthenticated("Invalid access token.")
    }

    const parsedPayload = jwtIdentityPayloadSchema.safeParse(decodedPayload)

    if (!parsedPayload.success) {
      throw this.unauthenticated("Invalid access token.")
    }

    return {
      id: parsedPayload.data.sub,
      name: parsedPayload.data.name,
      avatarUrl: parsedPayload.data.avatarUrl,
      avatarColor: parsedPayload.data.avatarColor,
    }
  }

  private readHeader(headers: HeaderBag, name: string): string | undefined {
    const value = headers[name.toLowerCase()] ?? headers[name]

    if (Array.isArray(value)) {
      return value[0]
    }

    if (typeof value === "string") {
      return value
    }

    return undefined
  }

  private readBearerToken(headers: HeaderBag): string | null {
    const authorization = this.readHeader(headers, authorizationHeaderName)

    if (!authorization) {
      return null
    }

    const [scheme, token] = authorization.trim().split(/\s+/, 2)

    if (!scheme || scheme.toLowerCase() !== "bearer") {
      return null
    }

    if (!token) {
      throw this.unauthenticated("Bearer token is required.")
    }

    return token
  }

  private unauthenticated(message = "Unauthenticated.") {
    return new UnauthorizedException({
      code: apiErrorCodeSchema.enum.UNAUTHENTICATED,
      message,
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
}
