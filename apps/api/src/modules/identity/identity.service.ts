import { Injectable, UnauthorizedException } from "@nestjs/common"
import {
  guestIdentitySchema,
  guestRestHeaderNames,
  guestRestHeadersSchema,
  socketAuthPayloadSchema,
  type GuestIdentity,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"

type HeaderBag = Record<string, unknown>

@Injectable()
export class IdentityService {
  constructor(private readonly prismaService: PrismaService) {}

  async resolveRestIdentity(headers: HeaderBag): Promise<UserSummary> {
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
      throw this.unauthenticated("JWT socket identity is not enabled yet.")
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

  private unauthenticated(message = "Guest identity is required.") {
    return new UnauthorizedException({
      code: "UNAUTHENTICATED",
      message,
    })
  }
}
