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
