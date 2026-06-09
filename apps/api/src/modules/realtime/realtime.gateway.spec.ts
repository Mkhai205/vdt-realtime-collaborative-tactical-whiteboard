import { ForbiddenException, UnauthorizedException } from "@nestjs/common"
import type {
  GetRoomObjectsResponse,
  JoinRoomResponse,
  OnlineUser,
  UserSummary,
} from "@rctw/shared-contracts"
import { toRoomSocketName } from "@rctw/shared-contracts"
import { IdentityService } from "../identity"
import { RoomsService } from "../rooms"
import { WhiteboardObjectsService } from "../whiteboard-objects"
import { PresenceService } from "./presence.service"
import { RealtimeGateway } from "./realtime.gateway"

const roomId = "11111111-1111-4111-8111-111111111111"
const userId = "22222222-2222-4222-8222-222222222222"
const now = "2026-06-06T00:00:00.000Z"

const currentUser: UserSummary = {
  id: userId,
  name: "Alpha Lead",
  avatarUrl: null,
  avatarColor: "#3B82F6",
}

const onlineUser: OnlineUser = {
  ...currentUser,
  role: "EDITOR",
  status: "ONLINE",
  selectedObjectId: null,
  connectedAt: now,
}

const joinResponse: JoinRoomResponse = {
  room: {
    id: roomId,
    name: "Operations Room",
    description: null,
    currentRevision: 3,
    isPublic: true,
    defaultJoinRole: "EDITOR",
    createdBy: currentUser,
    createdAt: now,
    updatedAt: now,
  },
  currentUser: {
    ...currentUser,
    role: "EDITOR",
  },
}

const objectsResponse: GetRoomObjectsResponse = {
  roomId,
  currentRevision: 7,
  objects: [],
}

type TestSocket = Parameters<RealtimeGateway["handleConnection"]>[0]

type TestSocketMocks = {
  emit: jest.Mock
  disconnect: jest.Mock
  join: jest.Mock
  leave: jest.Mock
}

function makeSocket(): TestSocket {
  return {
    id: "socket-1",
    data: {},
    handshake: {
      auth: {},
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  } as unknown as TestSocket
}

function getSocketMocks(socket: TestSocket): TestSocketMocks {
  return socket as unknown as TestSocketMocks
}

describe("RealtimeGateway", () => {
  const roomEmitter = {
    emit: jest.fn(),
  }
  const server = {
    to: jest.fn(() => roomEmitter),
  }
  const identityService = {
    resolveSocketIdentity: jest.fn(),
  }
  const roomsService = {
    joinRoom: jest.fn(),
  }
  const whiteboardObjectsService = {
    getRoomObjects: jest.fn(),
  }
  const presenceService = {
    getOnlineUsers: jest.fn(),
    joinRoom: jest.fn(),
    leaveAllRooms: jest.fn(),
    leaveRoom: jest.fn(),
  }
  let gateway: RealtimeGateway

  beforeEach(() => {
    jest.clearAllMocks()

    identityService.resolveSocketIdentity.mockResolvedValue(currentUser)
    roomsService.joinRoom.mockResolvedValue(joinResponse)
    whiteboardObjectsService.getRoomObjects.mockResolvedValue(objectsResponse)
    presenceService.getOnlineUsers.mockReturnValue([onlineUser])
    presenceService.joinRoom.mockReturnValue([onlineUser])
    presenceService.leaveAllRooms.mockReturnValue([])
    presenceService.leaveRoom.mockReturnValue([])

    gateway = new RealtimeGateway(
      identityService as unknown as IdentityService,
      roomsService as unknown as RoomsService,
      whiteboardObjectsService as unknown as WhiteboardObjectsService,
      presenceService as unknown as PresenceService,
    )
    const gatewayWithServer = gateway as unknown as { server: typeof server }
    gatewayWithServer.server = server
  })

  it("stores the resolved socket identity on connection", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)

    await gateway.handleConnection(socket)

    expect(identityService.resolveSocketIdentity).toHaveBeenCalledWith(
      socket.handshake.auth,
    )
    expect(socket.data.currentUser).toEqual(currentUser)
    expect(socketMocks.disconnect).not.toHaveBeenCalled()
  })

  it("emits an error and disconnects when socket auth is invalid", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    identityService.resolveSocketIdentity.mockRejectedValue(
      new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Invalid access token.",
      }),
    )

    await gateway.handleConnection(socket)

    expect(socketMocks.emit).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        code: "UNAUTHENTICATED",
        message: "Invalid access token.",
      }),
    )
    expect(socketMocks.disconnect).toHaveBeenCalledWith(true)
  })

  it("joins a room and emits the current room state", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser

    await gateway.handleRoomJoin(socket, { roomId })

    expect(roomsService.joinRoom).toHaveBeenCalledWith(currentUser, roomId)
    expect(whiteboardObjectsService.getRoomObjects).toHaveBeenCalledWith(
      currentUser,
      roomId,
    )
    expect(socketMocks.join).toHaveBeenCalledWith(toRoomSocketName(roomId))
    expect(presenceService.joinRoom).toHaveBeenCalledWith({
      socketId: socket.id,
      roomId,
      user: currentUser,
      role: "EDITOR",
    })
    expect(socketMocks.emit).toHaveBeenCalledWith("room:state", {
      room: {
        id: roomId,
        name: "Operations Room",
        description: null,
        currentRevision: 7,
        isPublic: true,
        defaultJoinRole: "EDITOR",
      },
      currentUser: joinResponse.currentUser,
      objects: [],
      onlineUsers: [onlineUser],
    })
    expect(server.to).toHaveBeenCalledWith(toRoomSocketName(roomId))
    expect(roomEmitter.emit).toHaveBeenCalledWith("presence:update", {
      roomId,
      onlineUsers: [onlineUser],
    })
  })

  it("emits validation errors for invalid room join payloads", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser

    await gateway.handleRoomJoin(socket, { roomId: "not-a-uuid" })

    expect(socketMocks.emit).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        code: "VALIDATION_ERROR",
      }),
    )
    expect(roomsService.joinRoom).not.toHaveBeenCalled()
  })

  it("maps room join failures to socket errors", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser
    roomsService.joinRoom.mockRejectedValue(
      new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "You do not have access to this room.",
      }),
    )

    await gateway.handleRoomJoin(socket, { roomId })

    expect(socketMocks.emit).toHaveBeenCalledWith("error", {
      code: "PERMISSION_DENIED",
      message: "You do not have access to this room.",
      details: undefined,
    })
    expect(socketMocks.join).not.toHaveBeenCalled()
  })

  it("leaves a room and emits updated presence", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)

    await gateway.handleRoomLeave(socket, { roomId })

    expect(socketMocks.leave).toHaveBeenCalledWith(toRoomSocketName(roomId))
    expect(presenceService.leaveRoom).toHaveBeenCalledWith(socket.id, roomId)
    expect(server.to).toHaveBeenCalledWith(toRoomSocketName(roomId))
  })

  it("removes disconnected sockets from every joined room", () => {
    const socket = makeSocket()
    presenceService.leaveAllRooms.mockReturnValue([roomId])

    gateway.handleDisconnect(socket)

    expect(presenceService.leaveAllRooms).toHaveBeenCalledWith(socket.id)
    expect(server.to).toHaveBeenCalledWith(toRoomSocketName(roomId))
    expect(roomEmitter.emit).toHaveBeenCalledWith("presence:update", {
      roomId,
      onlineUsers: [onlineUser],
    })
  })
})
