import { Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import {
  apiErrorCodeSchema,
  authorizationHeaderName,
  guestIdentitySchema,
  guestRestHeaderNames,
  guestRestHeadersSchema,
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

  async resolveRestIdentity(headers: HeaderBag): Promise<UserSummary> {
    const bearerToken = this.readBearerToken(headers)

    if (bearerToken) {
      return this.resolveJwtIdentity(bearerToken)
    }

    const parsed = guestRestHeadersSchema.safeParse({
      [guestRestHeaderNames.id]: this.readHeader(
        headers,
        guestRestHeaderNames.id,
      ),
      [guestRestHeaderNames.name]: this.readHeader(
        headers,
        guestRestHeaderNames.name,
      ),
      [guestRestHeaderNames.avatarColor]: this.readHeader(
        headers,
        guestRestHeaderNames.avatarColor,
      ),
    })

    if (!parsed.success) {
      throw this.unauthenticated()
    }

    return this.resolveGuestIdentity({
      id: parsed.data[guestRestHeaderNames.id],
      name: parsed.data[guestRestHeaderNames.name],
      avatarColor: parsed.data[guestRestHeaderNames.avatarColor],
    })
  }

  async resolveSocketIdentity(payload: unknown): Promise<UserSummary> {
    const parsed = socketAuthPayloadSchema.safeParse(payload ?? {})

    if (!parsed.success) {
      throw this.unauthenticated()
    }

    if (parsed.data.token) {
      return this.resolveJwtIdentity(parsed.data.token)
    }

    const guestIdentity = guestIdentitySchema.safeParse({
      id: parsed.data.guestId,
      name: parsed.data.guestName,
      avatarColor: parsed.data.guestAvatarColor,
    })

    if (!guestIdentity.success) {
      throw this.unauthenticated()
    }

    return this.resolveGuestIdentity(guestIdentity.data)
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

    const user = await this.findById(parsedPayload.data.sub)

    if (!user) {
      throw this.unauthenticated("Invalid access token.")
    }

    return user
  }

  private async resolveGuestIdentity(
    identity: GuestIdentity,
  ): Promise<UserSummary> {
    const existingUser = await this.findIdentityType(identity.id)

    if (existingUser && existingUser.identityType !== "GUEST") {
      throw this.unauthenticated("Invalid guest identity.")
    }

    return this.upsertGuest(identity)
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

  private unauthenticated(message = "Guest identity is required.") {
    return new UnauthorizedException({
      code: apiErrorCodeSchema.enum.UNAUTHENTICATED,
      message,
    })
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
}
