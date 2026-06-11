import type { UserSummary } from "@rctw/shared-contracts"
import { PresenceService } from "./presence.service"

const roomId = "11111111-1111-4111-8111-111111111111"
const otherRoomId = "22222222-2222-4222-8222-222222222222"

const userOne: UserSummary = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Alpha Lead",
  avatarUrl: null,
  avatarColor: "#3B82F6",
}

const userTwo: UserSummary = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Bravo Scout",
  avatarUrl: null,
  avatarColor: "#16A34A",
}

const objectId = "55555555-5555-4555-8555-555555555555"
const otherObjectId = "66666666-6666-4666-8666-666666666666"

describe("PresenceService", () => {
  let service: PresenceService

  beforeEach(() => {
    service = new PresenceService()
  })

  it("tracks online users by room", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "OWNER",
    })
    service.joinRoom({
      socketId: "socket-2",
      roomId: otherRoomId,
      user: userTwo,
      role: "EDITOR",
    })

    expect(service.getOnlineUsers(roomId)).toEqual([
      expect.objectContaining({
        id: userOne.id,
        role: "OWNER",
        status: "ONLINE",
      }),
    ])
    expect(service.getOnlineUsers(otherRoomId)).toEqual([
      expect.objectContaining({
        id: userTwo.id,
        role: "EDITOR",
        status: "ONLINE",
      }),
    ])
    expect(service.hasSocketInRoom("socket-1", roomId)).toBe(true)
    expect(service.hasSocketInRoom("socket-1", otherRoomId)).toBe(false)
    expect(service.getSocketRoomRole("socket-1", roomId)).toBe("OWNER")
    expect(service.getSocketRoomRole("socket-1", otherRoomId)).toBeNull()
  })

  it("deduplicates the same user across multiple sockets", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "EDITOR",
    })
    service.joinRoom({
      socketId: "socket-2",
      roomId,
      user: userOne,
      role: "EDITOR",
    })

    expect(service.getOnlineUsers(roomId)).toHaveLength(1)

    service.leaveRoom("socket-1", roomId)

    expect(service.getOnlineUsers(roomId)).toHaveLength(1)

    service.leaveRoom("socket-2", roomId)

    expect(service.getOnlineUsers(roomId)).toEqual([])
  })

  it("updates and clears selected object presence", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "EDITOR",
    })

    expect(
      service.updateSelectedObject({
        socketId: "socket-1",
        roomId,
        selectedObjectId: objectId,
      }),
    ).toEqual([
      expect.objectContaining({
        id: userOne.id,
        selectedObjectId: objectId,
      }),
    ])

    expect(
      service.updateSelectedObject({
        socketId: "socket-1",
        roomId,
        selectedObjectId: null,
      }),
    ).toEqual([
      expect.objectContaining({
        id: userOne.id,
        selectedObjectId: null,
      }),
    ])
  })

  it("does not update selected object presence for sockets outside the room", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "EDITOR",
    })

    expect(
      service.updateSelectedObject({
        socketId: "socket-2",
        roomId,
        selectedObjectId: objectId,
      }),
    ).toBeNull()
    expect(service.getOnlineUsers(roomId)).toEqual([
      expect.objectContaining({
        id: userOne.id,
        selectedObjectId: null,
      }),
    ])
  })

  it("tracks and clears active editing states by socket and room", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "EDITOR",
    })

    expect(
      service.startEditing({
        socketId: "socket-1",
        roomId,
        objectId,
      }),
    ).toBe(true)
    expect(
      service.startEditing({
        socketId: "socket-1",
        roomId,
        objectId: otherObjectId,
      }),
    ).toBe(true)

    expect(service.clearEditingForSocketRoom("socket-1", roomId)).toEqual([
      {
        roomId,
        objectId,
        user: userOne,
      },
      {
        roomId,
        objectId: otherObjectId,
        user: userOne,
      },
    ])
    expect(service.clearEditingForSocketRoom("socket-1", roomId)).toEqual([])
  })

  it("returns false when editing state is sent before joining a room", () => {
    expect(
      service.startEditing({
        socketId: "socket-1",
        roomId,
        objectId,
      }),
    ).toBe(false)
    expect(
      service.endEditing({
        socketId: "socket-1",
        roomId,
        objectId,
      }),
    ).toBe(false)
  })

  it("clears active editing states across all joined rooms", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "OWNER",
    })
    service.joinRoom({
      socketId: "socket-1",
      roomId: otherRoomId,
      user: userOne,
      role: "OWNER",
    })
    service.startEditing({
      socketId: "socket-1",
      roomId,
      objectId,
    })
    service.startEditing({
      socketId: "socket-1",
      roomId: otherRoomId,
      objectId: otherObjectId,
    })

    expect(service.clearEditingForSocket("socket-1")).toEqual([
      {
        roomId,
        objectId,
        user: userOne,
      },
      {
        roomId: otherRoomId,
        objectId: otherObjectId,
        user: userOne,
      },
    ])
    expect(service.clearEditingForSocket("socket-1")).toEqual([])
  })

  it("uses the latest active socket selection for duplicated users", () => {
    const dateNowSpy = jest.spyOn(Date, "now")

    try {
      service.joinRoom({
        socketId: "socket-1",
        roomId,
        user: userOne,
        role: "EDITOR",
      })
      service.joinRoom({
        socketId: "socket-2",
        roomId,
        user: userOne,
        role: "EDITOR",
      })

      dateNowSpy.mockReturnValue(1000)
      service.updateSelectedObject({
        socketId: "socket-1",
        roomId,
        selectedObjectId: objectId,
      })

      dateNowSpy.mockReturnValue(2000)
      service.updateSelectedObject({
        socketId: "socket-2",
        roomId,
        selectedObjectId: otherObjectId,
      })

      expect(service.getOnlineUsers(roomId)).toEqual([
        expect.objectContaining({
          id: userOne.id,
          selectedObjectId: otherObjectId,
        }),
      ])

      dateNowSpy.mockReturnValue(3000)
      service.updateSelectedObject({
        socketId: "socket-2",
        roomId,
        selectedObjectId: null,
      })

      expect(service.getOnlineUsers(roomId)).toEqual([
        expect.objectContaining({
          id: userOne.id,
          selectedObjectId: null,
        }),
      ])

      service.leaveRoom("socket-2", roomId)

      expect(service.getOnlineUsers(roomId)).toEqual([
        expect.objectContaining({
          id: userOne.id,
          selectedObjectId: objectId,
        }),
      ])
    } finally {
      dateNowSpy.mockRestore()
    }
  })

  it("removes a socket from every joined room on disconnect", () => {
    service.joinRoom({
      socketId: "socket-1",
      roomId,
      user: userOne,
      role: "OWNER",
    })
    service.joinRoom({
      socketId: "socket-1",
      roomId: otherRoomId,
      user: userOne,
      role: "OWNER",
    })

    expect(service.leaveAllRooms("socket-1").sort()).toEqual(
      [otherRoomId, roomId].sort(),
    )
    expect(service.getOnlineUsers(roomId)).toEqual([])
    expect(service.getOnlineUsers(otherRoomId)).toEqual([])
  })
})
