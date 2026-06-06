import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import { OAuth2Client } from "google-auth-library"
import { PrismaService } from "../../infrastructure/database"
import { googleOAuthStateCookieName, OAuthService } from "./oauth.service"

const googleUserId = "22222222-2222-4222-8222-222222222222"

type MockPrismaService = {
  client: {
    user: {
      findUnique: jest.Mock
      upsert: jest.Mock
    }
  }
}

function createService(overrides: Record<string, unknown> = {}) {
  const config = new Map<string, unknown>([
    ["GOOGLE_CLIENT_ID", "google-client-id"],
    ["GOOGLE_CLIENT_SECRET", "google-client-secret"],
    [
      "GOOGLE_CALLBACK_URL",
      "http://localhost:3001/api/v1/auth/google/callback",
    ],
    ["JWT_ACCESS_SECRET", "jwt-secret"],
    ["JWT_ACCESS_EXPIRES_IN_SECONDS", 900],
    [
      "FRONTEND_LOGIN_SUCCESS_REDIRECT",
      "http://localhost:3000/auth/callback/success",
    ],
    [
      "FRONTEND_LOGIN_FAILURE_REDIRECT",
      "http://localhost:3000/auth/callback/error",
    ],
    ...Object.entries(overrides),
  ])
  const configService = {
    get: jest.fn((key: string) => config.get(key)),
  }
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
  }
  const prismaService: MockPrismaService = {
    client: {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    },
  }
  const service = new OAuthService(
    configService as unknown as ConfigService,
    jwtService as unknown as JwtService,
    prismaService as unknown as PrismaService,
  )

  return { service, configService, jwtService, prismaService }
}

function mockVerifiedGoogleProfile(profile: {
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}) {
  jest.spyOn(OAuth2Client.prototype, "getToken").mockResolvedValue({
    tokens: {
      id_token: "google-id-token",
    },
  } as never)
  jest.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue({
    getPayload: () => profile,
  } as never)
}

describe("OAuthService", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns a clear configuration error when OAuth config is missing", () => {
    const { service } = createService({
      GOOGLE_CLIENT_ID: undefined,
    })

    expect(() => service.createGoogleAuthRedirect()).toThrow(
      "Google OAuth is not configured",
    )
  })

  it("creates a Google auth URL and short-lived state", () => {
    const { service } = createService()

    const redirect = service.createGoogleAuthRedirect()

    expect(redirect.state).toHaveLength(43)
    expect(redirect.url).toContain("accounts.google.com")
    expect(redirect.url).toContain("openid")
    expect(redirect.url).toContain(`state=${redirect.state}`)
  })

  it("rejects a callback with missing code", async () => {
    const { service } = createService()

    await expect(
      service.completeGoogleCallback(
        { state: "state" },
        `${googleOAuthStateCookieName}=state`,
      ),
    ).rejects.toMatchObject({
      reason: "missing_code",
    })
  })

  it("rejects a callback with missing state", async () => {
    const { service } = createService()

    await expect(
      service.completeGoogleCallback(
        { code: "code" },
        `${googleOAuthStateCookieName}=state`,
      ),
    ).rejects.toMatchObject({
      reason: "missing_state",
    })
  })

  it("rejects a callback with invalid state", async () => {
    const { service } = createService()

    await expect(
      service.completeGoogleCallback(
        { code: "code", state: "query-state" },
        `${googleOAuthStateCookieName}=cookie-state`,
      ),
    ).rejects.toMatchObject({
      reason: "invalid_state",
    })
  })

  it("creates a new GOOGLE user from a verified Google profile", async () => {
    const { service, prismaService, jwtService } = createService()
    mockVerifiedGoogleProfile({
      email: "lead@example.com",
      email_verified: true,
      name: "Alpha Lead",
      picture: "https://example.com/avatar.png",
    })
    prismaService.client.user.findUnique.mockResolvedValue(null)
    prismaService.client.user.upsert.mockResolvedValue({
      id: googleUserId,
      email: "lead@example.com",
      name: "Alpha Lead",
      avatarUrl: "https://example.com/avatar.png",
      avatarColor: "#3B82F6",
      identityType: "GOOGLE",
    })

    await expect(
      service.completeGoogleCallback(
        { code: "code", state: "state" },
        `${googleOAuthStateCookieName}=state`,
      ),
    ).resolves.toContain("#accessToken=signed.jwt.token")
    expect(prismaService.client.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "lead@example.com" },
        create: expect.objectContaining({
          email: "lead@example.com",
          name: "Alpha Lead",
          avatarUrl: "https://example.com/avatar.png",
          identityType: "GOOGLE",
        }),
      }),
    )
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: googleUserId,
        email: "lead@example.com",
        name: "Alpha Lead",
        identityType: "GOOGLE",
      }),
      expect.objectContaining({
        secret: "jwt-secret",
        expiresIn: 900,
      }),
    )
  })

  it("updates an existing Google user by email and reuses the same user", async () => {
    const { service, prismaService } = createService()
    mockVerifiedGoogleProfile({
      email: "lead@example.com",
      email_verified: true,
      name: "Updated Lead",
      picture: "https://example.com/new-avatar.png",
    })
    prismaService.client.user.findUnique.mockResolvedValue({
      avatarColor: "#16A34A",
    })
    prismaService.client.user.upsert.mockResolvedValue({
      id: googleUserId,
      email: "lead@example.com",
      name: "Updated Lead",
      avatarUrl: "https://example.com/new-avatar.png",
      avatarColor: "#16A34A",
      identityType: "GOOGLE",
    })

    await service.completeGoogleCallback(
      { code: "code", state: "state" },
      `${googleOAuthStateCookieName}=state`,
    )

    expect(prismaService.client.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "lead@example.com" },
        create: expect.objectContaining({
          avatarColor: "#16A34A",
        }),
        update: {
          name: "Updated Lead",
          avatarUrl: "https://example.com/new-avatar.png",
          identityType: "GOOGLE",
        },
      }),
    )
  })

  it("rejects unverified Google email", async () => {
    const { service } = createService()
    mockVerifiedGoogleProfile({
      email: "lead@example.com",
      email_verified: false,
      name: "Lead",
    })

    await expect(
      service.completeGoogleCallback(
        { code: "code", state: "state" },
        `${googleOAuthStateCookieName}=state`,
      ),
    ).rejects.toMatchObject({
      reason: "unverified_email",
    })
  })
})
