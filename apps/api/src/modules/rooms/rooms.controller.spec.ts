import type {
  AddRoomMemberRequest,
  RoomMemberMutationResponse,
  UpdateRoomMemberRoleRequest,
  UserSummary,
} from "@rctw/shared-contracts"
import { RoomsController } from "./rooms.controller"
import { RoomsService } from "./rooms.service"

describe("RoomsController F03.03 member management", () => {
  const roomId = "11111111-1111-4111-8111-111111111111"
  const memberId = "22222222-2222-4222-8222-222222222222"
  const userId = "33333333-3333-4333-8333-333333333333"
  const currentUser: UserSummary = {
    id: userId,
    name: "Owner",
    avatarUrl: null,
    avatarColor: "#3B82F6",
  }
  const roomsService = {
    addRoomMember: jest.fn(),
    updateRoomMemberRole: jest.fn(),
  }
  let controller: RoomsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new RoomsController(roomsService as unknown as RoomsService)
  })

  it("delegates direct member invites to RoomsService", async () => {
    const request: AddRoomMemberRequest = {
      userId,
      role: "EDITOR",
    }
    const response: RoomMemberMutationResponse = {
      member: {
        id: memberId,
        roomId,
        user: currentUser,
        role: "EDITOR",
        joinedAt: "2026-06-06T00:00:00.000Z",
      },
    }
    roomsService.addRoomMember.mockResolvedValue(response)

    await expect(
      controller.addRoomMember(
        currentUser,
        {
          roomId,
        },
        request,
      ),
    ).resolves.toBe(response)
    expect(roomsService.addRoomMember).toHaveBeenCalledWith(
      currentUser,
      roomId,
      request,
    )
  })

  it("delegates member role updates to RoomsService", async () => {
    const request: UpdateRoomMemberRoleRequest = {
      role: "VIEWER",
    }
    const response: RoomMemberMutationResponse = {
      member: {
        id: memberId,
        roomId,
        user: currentUser,
        role: "VIEWER",
        joinedAt: "2026-06-06T00:00:00.000Z",
      },
    }
    roomsService.updateRoomMemberRole.mockResolvedValue(response)

    await expect(
      controller.updateRoomMemberRole(
        currentUser,
        {
          roomId,
          memberId,
        },
        request,
      ),
    ).resolves.toBe(response)
    expect(roomsService.updateRoomMemberRole).toHaveBeenCalledWith(
      currentUser,
      roomId,
      memberId,
      request,
    )
  })
})
