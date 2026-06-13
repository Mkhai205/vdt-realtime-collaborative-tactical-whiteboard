/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { UnauthorizedException } from "@nestjs/common"
import { IdentityService } from "./identity.service"

describe("IdentityService", () => {
  let identityService: IdentityService
  let prismaService: any
  let jwtService: any
  let configService: any

  beforeEach(() => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }
    jwtService = {
      verifyAsync: jest.fn(),
    }
    configService = {
      getOrThrow: jest.fn(),
    }

    identityService = new IdentityService(
      prismaService,
      jwtService,
      configService,
    )
  })

  describe("resolveRestIdentity", () => {
    it("resolves JWT identity when Authorization Bearer token is present", async () => {
      const token = "valid-token"
      const userUuid = "d3b07384-d113-4ec5-a58e-0123456789ab"
      const payload = {
        sub: userUuid,
        email: "user@example.com",
        name: "Google User",
        identityType: "GOOGLE",
      }
      const user = {
        id: userUuid,
        name: "Google User",
        avatarUrl: null,
        avatarColor: "#3B82F6",
      }

      configService.getOrThrow.mockReturnValue("jwt-secret")
      jwtService.verifyAsync.mockResolvedValue(payload)
      prismaService.user.findUnique.mockResolvedValue(user)

      const result = await identityService.resolveRestIdentity({
        authorization: `Bearer ${token}`,
      })

      expect(result).toEqual(user)
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: "jwt-secret",
      })
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userUuid },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          avatarColor: true,
        },
      })
    })

    it("resolves guest identity when guest headers are present", async () => {
      const guestId = "d3b07384-d113-4ec5-a58e-0123456789ab"
      const guestName = "John Doe"
      const avatarColor = "#3B82F6"
      const user = {
        id: guestId,
        name: guestName,
        avatarUrl: null,
        avatarColor,
      }

      prismaService.user.findUnique.mockResolvedValue(null)
      prismaService.user.upsert.mockResolvedValue(user)

      const result = await identityService.resolveRestIdentity({
        "x-guest-id": guestId,
        "x-guest-name": guestName,
        "x-guest-avatar-color": avatarColor,
      })

      expect(result).toEqual(user)
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: guestId },
        select: { identityType: true },
      })
      expect(prismaService.user.upsert).toHaveBeenCalledWith({
        where: { id: guestId },
        create: {
          id: guestId,
          name: guestName,
          avatarColor,
          identityType: "GUEST",
        },
        update: {
          name: guestName,
          avatarColor,
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          avatarColor: true,
        },
      })
    })

    it("rejects guest identity when target ID belongs to a GOOGLE user", async () => {
      const guestId = "d3b07384-d113-4ec5-a58e-0123456789ab"
      const guestName = "John Doe"
      const avatarColor = "#3B82F6"

      prismaService.user.findUnique.mockResolvedValue({
        identityType: "GOOGLE",
      })

      await expect(
        identityService.resolveRestIdentity({
          "x-guest-id": guestId,
          "x-guest-name": guestName,
          "x-guest-avatar-color": avatarColor,
        }),
      ).rejects.toThrow(UnauthorizedException)

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: guestId },
        select: { identityType: true },
      })
      expect(prismaService.user.upsert).not.toHaveBeenCalled()
    })

    it("throws UnauthorizedException when no auth headers are present", async () => {
      await expect(identityService.resolveRestIdentity({})).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })
})
