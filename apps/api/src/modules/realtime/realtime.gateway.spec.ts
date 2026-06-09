import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common"
import type {
  GetRoomObjectsResponse,
  JoinRoomResponse,
  OnlineUser,
  OperationAppliedEvent,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import { toRoomSocketName } from "@rctw/shared-contracts"
import { IdentityService } from "../identity"
import { RoomsService } from "../rooms"
import { WhiteboardObjectsService } from "../whiteboard-objects"
import { PresenceService } from "./presence.service"
import { RealtimeGateway } from "./realtime.gateway"

const roomId = "11111111-1111-4111-8111-111111111111"
const userId = "22222222-2222-4222-8222-222222222222"
const objectId = "33333333-3333-4333-8333-333333333333"
const operationId = "44444444-4444-4444-8444-444444444444"
const clientOpId = "55555555-5555-4555-8555-555555555555"
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

const whiteboardObject: WhiteboardObject = {
  id: objectId,
  roomId,
  type: "RECTANGLE",
  x: 100,
  y: 200,
  width: 160,
  height: 96,
  points: null,
  text: null,
  rotation: 0,
  style: {
    fill: "#86efac",
    stroke: "#14532d",
    strokeWidth: 3,
  },
  zIndex: 10,
  version: 1,
  createdById: userId,
  updatedById: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}

const operationApplied: OperationAppliedEvent = {
  operationId,
  clientOpId,
  roomId,
  revision: 8,
  type: "OBJECT_CREATE",
  objectId,
  actor: currentUser,
  payload: {
    object: whiteboardObject,
  },
  resultingObject: whiteboardObject,
  createdAt: now,
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
    emit: jest.fn(),
    to: jest.fn(() => roomEmitter),
  }
  const identityService = {
    resolveSocketIdentity: jest.fn(),
  }
  const roomsService = {
    joinRoom: jest.fn(),
  }
  const whiteboardObjectsService = {
    createObject: jest.fn(),
    deleteObject: jest.fn(),
    getRoomObjects: jest.fn(),
    updateObject: jest.fn(),
  }
  const presenceService = {
    getOnlineUsers: jest.fn(),
    hasSocketInRoom: jest.fn(),
    joinRoom: jest.fn(),
    leaveAllRooms: jest.fn(),
    leaveRoom: jest.fn(),
  }
  let gateway: RealtimeGateway

  beforeEach(() => {
    jest.clearAllMocks()

    identityService.resolveSocketIdentity.mockResolvedValue(currentUser)
    roomsService.joinRoom.mockResolvedValue(joinResponse)
    whiteboardObjectsService.createObject.mockResolvedValue(operationApplied)
    whiteboardObjectsService.updateObject.mockResolvedValue({
      ...operationApplied,
      type: "OBJECT_UPDATE",
    })
    whiteboardObjectsService.deleteObject.mockResolvedValue({
      ...operationApplied,
      type: "OBJECT_DELETE",
    })
    whiteboardObjectsService.getRoomObjects.mockResolvedValue(objectsResponse)
    presenceService.getOnlineUsers.mockReturnValue([onlineUser])
    presenceService.hasSocketInRoom.mockReturnValue(true)
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

  it("persists object:create and broadcasts the accepted operation to the room", async () => {
    const socket = makeSocket()
    socket.data.currentUser = currentUser

    await gateway.handleObjectCreate(socket, {
      roomId,
      clientOpId,
      object: {
        type: "RECTANGLE",
        x: 100,
        y: 200,
        width: 160,
        height: 96,
      },
    })

    expect(presenceService.hasSocketInRoom).toHaveBeenCalledWith(
      socket.id,
      roomId,
    )
    expect(whiteboardObjectsService.createObject).toHaveBeenCalledWith(
      currentUser,
      roomId,
      {
        clientOpId,
        object: {
          type: "RECTANGLE",
          x: 100,
          y: 200,
          width: 160,
          height: 96,
        },
      },
    )
    expect(server.to).toHaveBeenCalledWith(toRoomSocketName(roomId))
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      "operation:applied",
      operationApplied,
    )
    expect(server.emit).not.toHaveBeenCalled()
  })

  it("persists object:update with object id and broadcasts the accepted operation", async () => {
    const socket = makeSocket()
    socket.data.currentUser = currentUser

    await gateway.handleObjectUpdate(socket, {
      roomId,
      objectId,
      clientOpId,
      baseObjectVersion: 1,
      patch: {
        x: 120,
      },
    })

    expect(whiteboardObjectsService.updateObject).toHaveBeenCalledWith(
      currentUser,
      roomId,
      objectId,
      {
        clientOpId,
        baseObjectVersion: 1,
        patch: {
          x: 120,
        },
      },
    )
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      "operation:applied",
      expect.objectContaining({
        type: "OBJECT_UPDATE",
      }),
    )
  })

  it("persists object:delete with object id and broadcasts the accepted operation", async () => {
    const socket = makeSocket()
    socket.data.currentUser = currentUser

    await gateway.handleObjectDelete(socket, {
      roomId,
      objectId,
      clientOpId,
      baseObjectVersion: 1,
    })

    expect(whiteboardObjectsService.deleteObject).toHaveBeenCalledWith(
      currentUser,
      roomId,
      objectId,
      {
        clientOpId,
        baseObjectVersion: 1,
      },
    )
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      "operation:applied",
      expect.objectContaining({
        type: "OBJECT_DELETE",
      }),
    )
  })

  it("emits operation:rejected for invalid object payloads when context is available", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser

    await gateway.handleObjectUpdate(socket, {
      roomId,
      objectId: "not-a-uuid",
      clientOpId,
      baseObjectVersion: 1,
      patch: {
        x: 120,
      },
    })

    expect(socketMocks.emit).toHaveBeenCalledWith("operation:rejected", {
      clientOpId,
      roomId,
      reason: "INVALID_OPERATION_PAYLOAD",
      message: "Invalid object operation payload.",
      latestObject: undefined,
      currentRoomRevision: undefined,
    })
    expect(whiteboardObjectsService.updateObject).not.toHaveBeenCalled()
  })

  it("emits generic socket validation errors when malformed object payloads lack operation context", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser

    await gateway.handleObjectCreate(socket, {})

    expect(socketMocks.emit).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        code: "VALIDATION_ERROR",
      }),
    )
    expect(whiteboardObjectsService.createObject).not.toHaveBeenCalled()
  })

  it("rejects object operations from sockets that have not joined the room", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser
    presenceService.hasSocketInRoom.mockReturnValue(false)

    await gateway.handleObjectDelete(socket, {
      roomId,
      objectId,
      clientOpId,
      baseObjectVersion: 1,
    })

    expect(socketMocks.emit).toHaveBeenCalledWith("operation:rejected", {
      clientOpId,
      roomId,
      reason: "USER_NOT_IN_ROOM",
      message: "Join the room before sending object operations.",
      latestObject: undefined,
      currentRoomRevision: undefined,
    })
    expect(whiteboardObjectsService.deleteObject).not.toHaveBeenCalled()
    expect(roomEmitter.emit).not.toHaveBeenCalledWith(
      "operation:applied",
      expect.anything(),
    )
  })

  it.each([
    [
      "permission failures",
      new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "Only room owners and editors can edit this room.",
      }),
      "PERMISSION_DENIED",
    ],
    [
      "duplicate client operations",
      new ConflictException({
        code: "DUPLICATE_OPERATION",
        message: "This client operation has already been processed.",
      }),
      "DUPLICATE_OPERATION",
    ],
    [
      "deleted objects",
      new ConflictException({
        code: "OBJECT_ALREADY_DELETED",
        message: "Whiteboard object has already been deleted.",
      }),
      "OBJECT_ALREADY_DELETED",
    ],
  ])(
    "emits operation:rejected for %s",
    async (_caseName, serviceError, expectedReason) => {
      const socket = makeSocket()
      const socketMocks = getSocketMocks(socket)
      socket.data.currentUser = currentUser
      whiteboardObjectsService.updateObject.mockRejectedValue(serviceError)

      await gateway.handleObjectUpdate(socket, {
        roomId,
        objectId,
        clientOpId,
        baseObjectVersion: 1,
        patch: {
          x: 120,
        },
      })

      expect(socketMocks.emit).toHaveBeenCalledWith(
        "operation:rejected",
        expect.objectContaining({
          clientOpId,
          roomId,
          reason: expectedReason,
        }),
      )
      expect(roomEmitter.emit).not.toHaveBeenCalledWith(
        "operation:applied",
        expect.anything(),
      )
    },
  )

  it("includes the latest object on version conflict rejections", async () => {
    const socket = makeSocket()
    const socketMocks = getSocketMocks(socket)
    socket.data.currentUser = currentUser
    whiteboardObjectsService.updateObject.mockRejectedValue(
      new ConflictException({
        code: "OBJECT_VERSION_CONFLICT",
        message: "Whiteboard object has changed since your last edit.",
        details: {
          latestObject: {
            ...whiteboardObject,
            version: 2,
          },
        },
      }),
    )

    await gateway.handleObjectUpdate(socket, {
      roomId,
      objectId,
      clientOpId,
      baseObjectVersion: 1,
      patch: {
        x: 120,
      },
    })

    expect(socketMocks.emit).toHaveBeenCalledWith(
      "operation:rejected",
      expect.objectContaining({
        clientOpId,
        roomId,
        reason: "OBJECT_VERSION_CONFLICT",
        latestObject: expect.objectContaining({
          id: objectId,
          version: 2,
        }),
      }),
    )
  })
})
