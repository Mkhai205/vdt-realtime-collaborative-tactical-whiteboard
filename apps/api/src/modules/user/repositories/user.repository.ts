import { Injectable } from "@nestjs/common"
import type { GuestIdentity, UserSummary } from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"

/** Fields returned for general user identification */
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
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Auth: JWT resolution ──────────────────────────────────────────────

  async findById(id: string): Promise<UserSummary | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSummarySelect,
    })
  }

  // ── Auth: Guest resolution ────────────────────────────────────────────

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
        identityType: "GUEST",
      },
      update: {
        name: identity.name,
        avatarColor: identity.avatarColor,
      },
      select: userSummarySelect,
    })
  }

  // ── Auth: OAuth (Google) ──────────────────────────────────────────────

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
        identityType: "GOOGLE",
      },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        identityType: "GOOGLE",
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

  // ── User profile ──────────────────────────────────────────────────────

  async findProfile(id: string): Promise<UserSummary | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSummarySelect,
    })
  }
}
