import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import type { UserSummary } from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { RoomsPermissionService } from "./rooms-permission.service"
import { RoomsService } from "./rooms.service"

const roomId = "11111111-1111-4111-8111-111111111111"
const ownerUserId = "22222222-2222-4222-8222-222222222222"
const targetUserId = "33333333-3333-4333-8333-333333333333"
const memberId = "44444444-4444-4444-8444-444444444444"
const now = new Date("2026-06-06T00:00:00.000Z")

const ownerUser: UserSummary = {
  id: ownerUserId,
  name: "Owner",
  avatarUrl: null,
  avatarColor: "#10B981",
}

const targetUser: UserSummary = {
  id: targetUserId,
  name: "Scout",
  avatarUrl: null,
  avatarColor: "#3B82F6",
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: roomId,
    name: "Private Briefing",
    description: null,
    currentRevision: 0n,
    isPublic: false,
    defaultJoinRole: "EDITOR",
    createdBy: ownerUser,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: memberId,
    roomId,
    user: targetUser,
    role: "EDITOR",
    joinedAt: now,
    removedAt: null,
    ...overrides,
  }
}

describe("RoomsService F03.03 private room and invite flow", () => {
  const tx = {
    room: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    roomMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }
  const prismaClient = {
    $transaction: jest.fn(),
  }
  const permissionService = {
    assertRoomMember: jest.fn(),
    assertRoomOwner: jest.fn(),
  }
  let service: RoomsService

  beforeEach(() => {
    jest.clearAllMocks()

    prismaClient.$transaction.mockImplementation(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
    )
    permissionService.assertRoomOwner.mockResolvedValue("OWNER")

    service = new RoomsService(
      prismaClient as unknown as PrismaService,
      permissionService as unknown as RoomsPermissionService,
    )
  })

  it("rejects private room joins for non-members", async () => {
    tx.room.findFirst.mockResolvedValue(
      makeRoom({
        members: [],
      }),
    )

    await expect(service.joinRoom(targetUser, roomId)).rejects.toThrow(
      ForbiddenException,
    )
    expect(tx.roomMember.create).not.toHaveBeenCalled()
    expect(tx.roomMember.update).not.toHaveBeenCalled()
  })

  it("allows the owner to add an existing user to a private room", async () => {
    tx.user.findUnique.mockResolvedValue(targetUser)
    tx.roomMember.findUnique.mockResolvedValue(null)
    tx.roomMember.create.mockResolvedValue(makeMember({ role: "VIEWER" }))

    const response = await service.addRoomMember(ownerUser, roomId, {
      userId: targetUserId,
      role: "VIEWER",
    })

    expect(permissionService.assertRoomOwner).toHaveBeenCalledWith(
      ownerUserId,
      roomId,
    )
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: {
        id: targetUserId,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        avatarColor: true,
      },
    })
    expect(tx.roomMember.create).toHaveBeenCalledWith({
      data: {
        roomId,
        userId: targetUserId,
        role: "VIEWER",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
      },
    })
    expect(response.member.role).toBe("VIEWER")
  })

  it("prevents non-owners from adding members", async () => {
    permissionService.assertRoomOwner.mockRejectedValue(
      new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "Only the room owner can modify this room.",
      }),
    )

    await expect(
      service.addRoomMember(ownerUser, roomId, {
        userId: targetUserId,
        role: "EDITOR",
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(prismaClient.$transaction).not.toHaveBeenCalled()
  })

  it("returns MEMBER_NOT_FOUND when the target user does not exist", async () => {
    tx.user.findUnique.mockResolvedValue(null)

    await expect(
      service.addRoomMember(ownerUser, roomId, {
        userId: targetUserId,
        role: "EDITOR",
      }),
    ).rejects.toThrow(NotFoundException)
  })

  it("reactivates a removed member with the requested role", async () => {
    tx.user.findUnique.mockResolvedValue(targetUser)
    tx.roomMember.findUnique.mockResolvedValue({
      id: memberId,
      role: "VIEWER",
      removedAt: now,
    })
    tx.roomMember.update.mockResolvedValue(makeMember({ role: "EDITOR" }))

    const response = await service.addRoomMember(ownerUser, roomId, {
      userId: targetUserId,
      role: "EDITOR",
    })

    expect(tx.roomMember.update).toHaveBeenCalledWith({
      where: {
        id: memberId,
      },
      data: {
        joinedAt: expect.any(Date),
        removedAt: null,
        role: "EDITOR",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
      },
    })
    expect(tx.roomMember.create).not.toHaveBeenCalled()
    expect(response.member.role).toBe("EDITOR")
  })

  it("updates an existing active non-owner member without creating a duplicate", async () => {
    tx.user.findUnique.mockResolvedValue(targetUser)
    tx.roomMember.findUnique.mockResolvedValue({
      id: memberId,
      role: "VIEWER",
      removedAt: null,
    })
    tx.roomMember.update.mockResolvedValue(makeMember({ role: "EDITOR" }))

    await service.addRoomMember(ownerUser, roomId, {
      userId: targetUserId,
      role: "EDITOR",
    })

    expect(tx.roomMember.update).toHaveBeenCalledWith({
      where: {
        id: memberId,
      },
      data: {
        role: "EDITOR",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
      },
    })
    expect(tx.roomMember.create).not.toHaveBeenCalled()
  })

  it("does not allow owner membership to be modified through add member", async () => {
    tx.user.findUnique.mockResolvedValue(ownerUser)
    tx.roomMember.findUnique.mockResolvedValue({
      id: memberId,
      role: "OWNER",
      removedAt: null,
    })

    await expect(
      service.addRoomMember(ownerUser, roomId, {
        userId: ownerUserId,
        role: "VIEWER",
      }),
    ).rejects.toThrow(BadRequestException)
    expect(tx.roomMember.update).not.toHaveBeenCalled()
  })

  it("allows the owner to change an active non-owner member role", async () => {
    tx.roomMember.findFirst.mockResolvedValue({
      id: memberId,
      role: "VIEWER",
    })
    tx.roomMember.update.mockResolvedValue(makeMember({ role: "EDITOR" }))

    const response = await service.updateRoomMemberRole(
      ownerUser,
      roomId,
      memberId,
      {
        role: "EDITOR",
      },
    )

    expect(permissionService.assertRoomOwner).toHaveBeenCalledWith(
      ownerUserId,
      roomId,
    )
    expect(tx.roomMember.findFirst).toHaveBeenCalledWith({
      where: {
        id: memberId,
        roomId,
        removedAt: null,
      },
      select: {
        id: true,
        role: true,
      },
    })
    expect(response.member.role).toBe("EDITOR")
  })

  it("prevents non-owners from changing member roles", async () => {
    permissionService.assertRoomOwner.mockRejectedValue(
      new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "Only the room owner can modify this room.",
      }),
    )

    await expect(
      service.updateRoomMemberRole(ownerUser, roomId, memberId, {
        role: "VIEWER",
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(prismaClient.$transaction).not.toHaveBeenCalled()
  })

  it("does not allow owner membership to be modified through role update", async () => {
    tx.roomMember.findFirst.mockResolvedValue({
      id: memberId,
      role: "OWNER",
    })

    await expect(
      service.updateRoomMemberRole(ownerUser, roomId, memberId, {
        role: "VIEWER",
      }),
    ).rejects.toThrow(BadRequestException)
    expect(tx.roomMember.update).not.toHaveBeenCalled()
  })
})
