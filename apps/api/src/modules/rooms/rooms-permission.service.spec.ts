import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../../infrastructure/database"
import { RoomsPermissionService } from "./rooms-permission.service"

describe("RoomsPermissionService", () => {
  const findFirst = jest.fn()
  let service: RoomsPermissionService

  beforeEach(() => {
    jest.clearAllMocks()

    service = new RoomsPermissionService({
      room: {
        findFirst,
      },
    } as unknown as PrismaService)
  })

  it("allows owners and editors to edit, but keeps viewers read-only", () => {
    expect(service.canEdit("OWNER")).toBe(true)
    expect(service.canEdit("EDITOR")).toBe(true)
    expect(service.canEdit("VIEWER")).toBe(false)
    expect(() => service.assertCanEdit("VIEWER")).toThrow(ForbiddenException)
  })

  it("allows only owners to manage rooms", () => {
    expect(service.canManageRoom("OWNER")).toBe(true)
    expect(service.canManageRoom("EDITOR")).toBe(false)
    expect(service.canManageRoom("VIEWER")).toBe(false)
    expect(() => service.assertCanManageRoom("EDITOR")).toThrow(
      ForbiddenException,
    )
  })

  it("returns the active room member role", async () => {
    findFirst.mockResolvedValue({
      members: [
        {
          role: "EDITOR",
        },
      ],
    })

    await expect(service.assertRoomMember("user-1", "room-1")).resolves.toBe(
      "EDITOR",
    )
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "room-1",
        deletedAt: null,
      },
      select: {
        members: {
          where: {
            userId: "user-1",
            removedAt: null,
          },
          select: {
            role: true,
          },
          take: 1,
        },
      },
    })
  })

  it("rejects missing or deleted rooms as not found", async () => {
    findFirst.mockResolvedValue(null)

    await expect(service.assertRoomMember("user-1", "room-1")).rejects.toThrow(
      NotFoundException,
    )
  })

  it("rejects users who have not joined the room", async () => {
    findFirst.mockResolvedValue({
      members: [],
    })

    await expect(service.assertRoomMember("user-1", "room-1")).rejects.toThrow(
      ForbiddenException,
    )
  })

  it("uses active membership before enforcing owner-only access", async () => {
    findFirst.mockResolvedValue({
      members: [
        {
          role: "EDITOR",
        },
      ],
    })

    await expect(service.assertRoomOwner("user-1", "room-1")).rejects.toThrow(
      ForbiddenException,
    )
  })
})
