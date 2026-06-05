import { Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import {
  authorizationHeaderName,
  guestIdentitySchema,
  guestRestHeaderNames,
  guestRestHeadersSchema,
  jwtIdentityPayloadSchema,
  socketAuthPayloadSchema,
  type GuestIdentity,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"

type HeaderBag = Record<string, unknown>

@Injectable()
export class IdentityService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    const jwtSecret = this.configService.get<string>("JWT_ACCESS_SECRET")

    if (!jwtSecret) {
      throw this.unauthenticated("JWT authentication is not configured.")
    }

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

    const user = await this.prismaService.client.user.findUnique({
      where: {
        id: parsedPayload.data.sub,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        avatarColor: true,
      },
    })

    if (!user) {
      throw this.unauthenticated("Invalid access token.")
    }

    return user
  }

  private async resolveGuestIdentity(
    identity: GuestIdentity,
  ): Promise<UserSummary> {
    const user = await this.prismaService.client.user.upsert({
      where: {
        id: identity.id,
      },
      create: {
        id: identity.id,
        name: identity.name,
        avatarColor: identity.avatarColor,
        identityType: "GUEST",
      },
      update: {
        name: identity.name,
        avatarColor: identity.avatarColor,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        avatarColor: true,
      },
    })

    return user
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
      code: "UNAUTHENTICATED",
      message,
    })
  }
}
