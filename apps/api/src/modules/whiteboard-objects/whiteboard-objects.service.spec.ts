import { ConflictException, ForbiddenException } from "@nestjs/common"
import type { UserSummary } from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { RoomsPermissionService } from "../rooms"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

const roomId = "11111111-1111-4111-8111-111111111111"
const objectId = "22222222-2222-4222-8222-222222222222"
const userId = "33333333-3333-4333-8333-333333333333"
const operationId = "44444444-4444-4444-8444-444444444444"
const clientOpId = "55555555-5555-4555-8555-555555555555"
const now = new Date("2026-06-09T00:00:00.000Z")

const currentUser: UserSummary = {
  id: userId,
  name: "Editor",
  avatarUrl: null,
  avatarColor: "#3B82F6",
}

function makeObject(overrides: Record<string, unknown> = {}) {
  return {
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
    version: 3,
    createdById: userId,
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeSerializedObject(overrides: Record<string, unknown> = {}) {
  return makeObject({
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt: null,
    ...overrides,
  })
}

function makeOperation(overrides: Record<string, unknown> = {}) {
  return {
    id: operationId,
    clientOpId,
    roomId,
    objectId,
    revision: 7n,
    type: "OBJECT_UPDATE",
    payload: {
      objectId,
      patch: {
        text: "Updated label",
        style: {
          fill: "#ffffff",
        },
      },
      resultingObject: makeObject({
        type: "TEXT",
      }),
    },
    createdAt: now,
    actor: currentUser,
    object: {
      type: "TEXT",
    },
    ...overrides,
  }
}

describe("WhiteboardObjectsService", () => {
  const tx = {
    room: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    whiteboardObject: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    whiteboardOperation: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  }
  const prismaClient = {
    $transaction: jest.fn(),
    room: {
      findFirst: jest.fn(),
    },
    whiteboardObject: {
      findMany: jest.fn(),
    },
    whiteboardOperation: {
      findMany: jest.fn(),
    },
  }
  const permissionService = {
    assertRoomMember: jest.fn(),
    canEdit: jest.fn(),
  }
  let service: WhiteboardObjectsService

  function expectMutationTransactionUsed() {
    expect(prismaClient.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaClient.$transaction).toHaveBeenCalledWith(expect.any(Function))
  }

  function expectRoomRevisionIncrementedOnce() {
    expect(tx.room.update).toHaveBeenCalledTimes(1)
    expect(tx.room.update).toHaveBeenCalledWith({
      where: { id: roomId },
      data: { currentRevision: { increment: 1 } },
      select: { currentRevision: true },
    })
  }

  function expectNoRevisionWrite() {
    expect(tx.room.update).not.toHaveBeenCalled()
    expect(tx.whiteboardOperation.create).not.toHaveBeenCalled()
  }

  function expectActiveObjectLoad() {
    expect(prismaClient.whiteboardObject.findMany).toHaveBeenCalledWith({
      where: {
        roomId,
        deletedAt: null,
      },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()

    prismaClient.$transaction.mockImplementation(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
    )
    permissionService.assertRoomMember.mockResolvedValue("EDITOR")
    permissionService.canEdit.mockImplementation(
      (role: string) => role !== "VIEWER",
    )
    tx.room.findFirst.mockResolvedValue({
      members: [{ role: "EDITOR" }],
    })
    tx.room.update.mockResolvedValue({
      currentRevision: 7n,
    })
    tx.whiteboardOperation.findUnique.mockResolvedValue(null)
    tx.whiteboardObject.updateMany.mockResolvedValue({
      count: 1,
    })
    tx.whiteboardOperation.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: operationId,
          createdAt: now,
          ...data,
        }),
    )

    service = new WhiteboardObjectsService(
      {
        client: prismaClient,
      } as unknown as PrismaService,
      permissionService as unknown as RoomsPermissionService,
    )
  })

  it("loads active room objects with the current revision", async () => {
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 6n,
    })
    prismaClient.whiteboardObject.findMany.mockResolvedValue([
      makeObject(),
      makeObject({
        id: "66666666-6666-4666-8666-666666666666",
        zIndex: 20,
      }),
    ])

    const response = await service.getRoomObjects(currentUser, roomId)

    expect(permissionService.assertRoomMember).toHaveBeenCalledWith(
      userId,
      roomId,
    )
    expect(prismaClient.whiteboardObject.findMany).toHaveBeenCalledWith({
      where: {
        roomId,
        deletedAt: null,
      },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })
    expect(response.currentRevision).toBe(6)
    expect(typeof response.currentRevision).toBe("number")
    expect(response.objects).toHaveLength(2)
    expect(prismaClient.$transaction).not.toHaveBeenCalled()
  })

  it.each(["OWNER", "EDITOR", "VIEWER"] as const)(
    "loads latest room operations for %s members",
    async (role) => {
      permissionService.assertRoomMember.mockResolvedValue(role)
      prismaClient.whiteboardOperation.findMany.mockResolvedValue([
        makeOperation(),
      ])

      const response = await service.getRoomOperations(currentUser, roomId, {
        limit: 50,
      })

      expect(permissionService.assertRoomMember).toHaveBeenCalledWith(
        userId,
        roomId,
      )
      expect(prismaClient.whiteboardOperation.findMany).toHaveBeenCalledWith({
        where: {
          roomId,
        },
        orderBy: {
          revision: "desc",
        },
        take: 50,
        select: {
          id: true,
          clientOpId: true,
          roomId: true,
          objectId: true,
          revision: true,
          type: true,
          payload: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              avatarColor: true,
            },
          },
          object: {
            select: {
              type: true,
            },
          },
        },
      })
      expect(response).toEqual({
        roomId,
        operations: [
          expect.objectContaining({
            id: operationId,
            clientOpId,
            roomId,
            objectId,
            revision: 7,
            type: "OBJECT_UPDATE",
            actor: currentUser,
            objectType: "TEXT",
            summary: "Updated text: text, style",
            createdAt: now.toISOString(),
          }),
        ],
      })
    },
  )

  it("uses a default limit of 50 for operation history", async () => {
    prismaClient.whiteboardOperation.findMany.mockResolvedValue([])

    await service.getRoomOperations(currentUser, roomId)

    expect(prismaClient.whiteboardOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    )
  })

  it("caps operation history limits at 100", async () => {
    prismaClient.whiteboardOperation.findMany.mockResolvedValue([])

    await service.getRoomOperations(currentUser, roomId, {
      limit: 150,
    })

    expect(prismaClient.whiteboardOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    )
  })

  it("requires room membership before loading operation history", async () => {
    permissionService.assertRoomMember.mockRejectedValue(
      new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "You must join this room first.",
      }),
    )

    await expect(
      service.getRoomOperations(currentUser, roomId),
    ).rejects.toThrow(ForbiddenException)
    expect(prismaClient.whiteboardOperation.findMany).not.toHaveBeenCalled()
  })

  it("returns empty operation replay when the client has the current revision", async () => {
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 7n,
    })

    const response = await service.getRoomOperationReplay(currentUser, roomId, 7)

    expect(permissionService.assertRoomMember).toHaveBeenCalledWith(
      userId,
      roomId,
    )
    expect(prismaClient.whiteboardOperation.findMany).not.toHaveBeenCalled()
    expect(prismaClient.whiteboardObject.findMany).not.toHaveBeenCalled()
    expect(response).toEqual({
      mode: "OPERATIONS",
      roomId,
      fromRevision: 7,
      toRevision: 7,
      operations: [],
    })
  })

  it("loads operation replay after the last seen revision in ascending order", async () => {
    const createdObject = makeSerializedObject({
      id: "22222222-2222-4222-8222-222222222223",
    })
    const updatedObject = makeSerializedObject({
      id: "22222222-2222-4222-8222-222222222224",
      x: 240,
      version: 4,
    })
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 8n,
    })
    prismaClient.whiteboardOperation.findMany.mockResolvedValue([
      makeOperation({
        id: "44444444-4444-4444-8444-444444444445",
        clientOpId: "create-client-op",
        objectId: createdObject.id,
        revision: 6n,
        type: "OBJECT_CREATE",
        payload: {
          object: createdObject,
        },
      }),
      makeOperation({
        id: "44444444-4444-4444-8444-444444444446",
        clientOpId: "update-client-op",
        objectId: updatedObject.id,
        revision: 7n,
        type: "OBJECT_UPDATE",
        payload: {
          objectId: updatedObject.id,
          patch: {
            x: 240,
          },
          resultingObject: updatedObject,
        },
      }),
      makeOperation({
        id: "44444444-4444-4444-8444-444444444447",
        clientOpId: "delete-client-op",
        objectId,
        revision: 8n,
        type: "OBJECT_DELETE",
        payload: {
          objectId,
          previousObject: makeSerializedObject(),
        },
      }),
    ])

    const response = await service.getRoomOperationReplay(currentUser, roomId, 5)

    expect(prismaClient.whiteboardOperation.findMany).toHaveBeenCalledWith({
      where: {
        roomId,
        revision: {
          gt: 5n,
          lte: 8n,
        },
      },
      orderBy: {
        revision: "asc",
      },
      select: {
        id: true,
        clientOpId: true,
        roomId: true,
        objectId: true,
        revision: true,
        type: true,
        payload: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
      },
    })
    expect(response).toEqual({
      mode: "OPERATIONS",
      roomId,
      fromRevision: 5,
      toRevision: 8,
      operations: [
        expect.objectContaining({
          clientOpId: "create-client-op",
          revision: 6,
          type: "OBJECT_CREATE",
          actor: currentUser,
          payload: {
            object: createdObject,
          },
          resultingObject: createdObject,
        }),
        expect.objectContaining({
          clientOpId: "update-client-op",
          revision: 7,
          type: "OBJECT_UPDATE",
          payload: {
            objectId: updatedObject.id,
            patch: {
              x: 240,
            },
            resultingObject: updatedObject,
          },
          resultingObject: updatedObject,
        }),
        expect.objectContaining({
          clientOpId: "delete-client-op",
          revision: 8,
          type: "OBJECT_DELETE",
          resultingObject: null,
        }),
      ],
    })
    expect(prismaClient.whiteboardObject.findMany).not.toHaveBeenCalled()
  })

  it("falls back to full state when the client revision is ahead of the room", async () => {
    const activeObject = makeObject({
      id: "22222222-2222-4222-8222-222222222225",
    })
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 8n,
    })
    prismaClient.whiteboardObject.findMany.mockResolvedValue([activeObject])

    const response = await service.getRoomOperationReplay(currentUser, roomId, 9)

    expect(prismaClient.whiteboardOperation.findMany).not.toHaveBeenCalled()
    expectActiveObjectLoad()
    expect(response).toEqual({
      mode: "FULL_STATE",
      roomId,
      revision: 8,
      objects: [
        expect.objectContaining({
          id: activeObject.id,
          deletedAt: null,
        }),
      ],
    })
  })

  it("falls back to full state when the replay range exceeds 100 revisions", async () => {
    const activeObject = makeObject()
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 106n,
    })
    prismaClient.whiteboardObject.findMany.mockResolvedValue([activeObject])

    const response = await service.getRoomOperationReplay(currentUser, roomId, 5)

    expect(prismaClient.whiteboardOperation.findMany).not.toHaveBeenCalled()
    expectActiveObjectLoad()
    expect(response).toEqual({
      mode: "FULL_STATE",
      roomId,
      revision: 106,
      objects: [
        expect.objectContaining({
          id: activeObject.id,
          deletedAt: null,
        }),
      ],
    })
  })

  it("falls back to full state when replay rows are missing", async () => {
    const activeObject = makeObject()
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 8n,
    })
    prismaClient.whiteboardOperation.findMany.mockResolvedValue([
      makeOperation({ revision: 6n }),
      makeOperation({ revision: 7n }),
    ])
    prismaClient.whiteboardObject.findMany.mockResolvedValue([activeObject])

    const response = await service.getRoomOperationReplay(currentUser, roomId, 5)

    expect(prismaClient.whiteboardOperation.findMany).toHaveBeenCalled()
    expectActiveObjectLoad()
    expect(response).toEqual({
      mode: "FULL_STATE",
      roomId,
      revision: 8,
      objects: [
        expect.objectContaining({
          id: activeObject.id,
          deletedAt: null,
        }),
      ],
    })
  })

  it("falls back to full state when replay revisions are not contiguous", async () => {
    const activeObject = makeObject()
    prismaClient.room.findFirst.mockResolvedValue({
      currentRevision: 8n,
    })
    prismaClient.whiteboardOperation.findMany.mockResolvedValue([
      makeOperation({ revision: 6n }),
      makeOperation({ revision: 8n }),
      makeOperation({ revision: 8n }),
    ])
    prismaClient.whiteboardObject.findMany.mockResolvedValue([activeObject])

    const response = await service.getRoomOperationReplay(currentUser, roomId, 5)

    expect(prismaClient.whiteboardOperation.findMany).toHaveBeenCalled()
    expectActiveObjectLoad()
    expect(response).toEqual({
      mode: "FULL_STATE",
      roomId,
      revision: 8,
      objects: [
        expect.objectContaining({
          id: activeObject.id,
          deletedAt: null,
        }),
      ],
    })
  })

  it("requires room membership before loading operation replay", async () => {
    permissionService.assertRoomMember.mockRejectedValue(
      new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "You must join this room first.",
      }),
    )

    await expect(
      service.getRoomOperationReplay(currentUser, roomId, 5),
    ).rejects.toThrow(ForbiddenException)
    expect(prismaClient.room.findFirst).not.toHaveBeenCalled()
    expect(prismaClient.whiteboardOperation.findMany).not.toHaveBeenCalled()
  })

  it("persists created objects and records an operation", async () => {
    tx.whiteboardObject.create.mockResolvedValue(makeObject({ version: 1 }))

    const response = await service.createObject(currentUser, roomId, {
      clientOpId,
      object: {
        type: "RECTANGLE",
        x: 100,
        y: 200,
        width: 160,
        height: 96,
        style: {
          fill: "#86efac",
        },
      },
    })

    expect(tx.whiteboardObject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId,
        type: "RECTANGLE",
        version: 1,
        createdById: userId,
      }),
    })
    expectMutationTransactionUsed()
    expectRoomRevisionIncrementedOnce()
    expect(tx.whiteboardOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientOpId,
        roomId,
        actorId: userId,
        objectId,
        revision: 7n,
        type: "OBJECT_CREATE",
        inversePayload: {
          objectId,
        },
      }),
    })
    expect(tx.whiteboardOperation.create).toHaveBeenCalledTimes(1)
    expect(response.type).toBe("OBJECT_CREATE")
    expect(response.revision).toBe(7)
    expect(typeof response.revision).toBe("number")
    expect(response.resultingObject?.id).toBe(objectId)
    expect(response.resultingObject?.version).toBe(1)
  })

  it("persists object patches with merged style and records previous values", async () => {
    tx.whiteboardObject.findFirst
      .mockResolvedValueOnce(makeObject())
      .mockResolvedValueOnce(
        makeObject({
          x: 120,
          style: {
            fill: "#86efac",
            stroke: "#000000",
            strokeWidth: 3,
          },
          version: 4,
          updatedById: userId,
        }),
      )

    const response = await service.updateObject(currentUser, roomId, objectId, {
      clientOpId,
      baseObjectVersion: 3,
      patch: {
        x: 120,
        style: {
          stroke: "#000000",
        },
      },
    })

    expect(tx.whiteboardObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: objectId,
        roomId,
        deletedAt: null,
        version: 3,
      },
      data: expect.objectContaining({
        x: 120,
        updatedById: userId,
        version: {
          increment: 1,
        },
        style: {
          fill: "#86efac",
          stroke: "#000000",
          strokeWidth: 3,
        },
      }),
    })
    expect(tx.whiteboardObject.update).not.toHaveBeenCalled()
    expectMutationTransactionUsed()
    expectRoomRevisionIncrementedOnce()
    expect(tx.whiteboardOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revision: 7n,
        type: "OBJECT_UPDATE",
        baseObjectVersion: 3,
        payload: expect.objectContaining({
          previousValues: expect.objectContaining({
            x: 100,
          }),
        }),
        inversePayload: {
          objectId,
          patch: expect.objectContaining({
            x: 100,
            style: {
              fill: "#86efac",
              stroke: "#14532d",
              strokeWidth: 3,
            },
          }),
        },
      }),
    })
    expect(tx.whiteboardOperation.create).toHaveBeenCalledTimes(1)
    expect(response.revision).toBe(7)
    expect(typeof response.revision).toBe("number")
    expect(response.resultingObject?.version).toBe(4)
  })

  it("soft deletes objects and records the previous object", async () => {
    tx.whiteboardObject.findFirst
      .mockResolvedValueOnce(makeObject())
      .mockResolvedValueOnce(
        makeObject({
          deletedAt: now,
          version: 4,
          updatedById: userId,
        }),
      )

    const response = await service.deleteObject(currentUser, roomId, objectId, {
      clientOpId,
      baseObjectVersion: 3,
    })

    expect(tx.whiteboardObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: objectId,
        roomId,
        deletedAt: null,
        version: 3,
      },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        updatedById: userId,
        version: {
          increment: 1,
        },
      }),
    })
    expect(tx.whiteboardObject.update).not.toHaveBeenCalled()
    expectMutationTransactionUsed()
    expectRoomRevisionIncrementedOnce()
    expect(tx.whiteboardOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revision: 7n,
        type: "OBJECT_DELETE",
        baseObjectVersion: 3,
        payload: expect.objectContaining({
          previousObject: expect.objectContaining({
            id: objectId,
          }),
        }),
        inversePayload: {
          objectId,
          restoredObject: expect.objectContaining({
            id: objectId,
            version: 3,
          }),
        },
      }),
    })
    expect(tx.whiteboardOperation.create).toHaveBeenCalledTimes(1)
    expect(response.type).toBe("OBJECT_DELETE")
    expect(response.revision).toBe(7)
    expect(typeof response.revision).toBe("number")
    expect(response.resultingObject?.deletedAt).toBe(now.toISOString())
    expect(response.resultingObject?.version).toBe(4)
  })

  it("restores soft-deleted objects and records a restore operation", async () => {
    tx.whiteboardObject.findFirst
      .mockResolvedValueOnce(
        makeObject({
          deletedAt: now,
          version: 4,
        }),
      )
      .mockResolvedValueOnce(
        makeObject({
          deletedAt: null,
          version: 5,
          updatedById: userId,
        }),
      )

    const response = await service.restoreObject(currentUser, roomId, objectId, {
      clientOpId,
      baseObjectVersion: 4,
    })

    expect(tx.whiteboardObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: objectId,
        roomId,
        deletedAt: {
          not: null,
        },
        version: 4,
      },
      data: expect.objectContaining({
        deletedAt: null,
        updatedById: userId,
        version: {
          increment: 1,
        },
      }),
    })
    expectMutationTransactionUsed()
    expectRoomRevisionIncrementedOnce()
    expect(tx.whiteboardOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revision: 7n,
        type: "OBJECT_RESTORE",
        baseObjectVersion: 4,
        payload: expect.objectContaining({
          previousObject: expect.objectContaining({
            id: objectId,
            deletedAt: now.toISOString(),
          }),
          resultingObject: expect.objectContaining({
            id: objectId,
            deletedAt: null,
          }),
        }),
        inversePayload: {
          objectId,
        },
      }),
    })
    expect(response.type).toBe("OBJECT_RESTORE")
    expect(response.resultingObject?.deletedAt).toBeNull()
    expect(response.resultingObject?.version).toBe(5)
  })

  it("rejects viewer create attempts", async () => {
    tx.room.findFirst.mockResolvedValue({
      members: [{ role: "VIEWER" }],
    })

    await expect(
      service.createObject(currentUser, roomId, {
        clientOpId,
        object: {
          type: "TEXT",
          x: 10,
          y: 20,
          text: "Read only",
        },
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(tx.whiteboardObject.create).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })

  it("rejects viewer restore attempts", async () => {
    tx.room.findFirst.mockResolvedValue({
      members: [{ role: "VIEWER" }],
    })

    await expect(
      service.restoreObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 4,
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(tx.whiteboardObject.updateMany).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })

  it("rejects restore attempts for missing objects", async () => {
    tx.whiteboardObject.findFirst.mockResolvedValue(null)

    await expect(
      service.restoreObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 4,
      }),
    ).rejects.toMatchObject({
      response: {
        code: "OBJECT_NOT_FOUND",
      },
    })
    expect(tx.whiteboardObject.updateMany).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })

  it("rejects restore attempts for active objects", async () => {
    tx.room.findFirst
      .mockResolvedValueOnce({
        members: [{ role: "EDITOR" }],
      })
      .mockResolvedValueOnce({
        currentRevision: 8n,
      })
    tx.whiteboardObject.findFirst.mockResolvedValue(makeObject({ version: 4 }))

    await expect(
      service.restoreObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 4,
      }),
    ).rejects.toMatchObject({
      response: {
        code: "OBJECT_VERSION_CONFLICT",
        details: {
          currentRoomRevision: 8,
          latestObject: expect.objectContaining({
            id: objectId,
            version: 4,
          }),
        },
      },
    })
    expect(tx.whiteboardObject.updateMany).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })

  it("rejects stale object updates after a conditional write miss", async () => {
    tx.whiteboardObject.updateMany.mockResolvedValue({
      count: 0,
    })
    tx.whiteboardObject.findFirst
      .mockResolvedValueOnce(makeObject())
      .mockResolvedValueOnce(makeObject({ version: 4 }))
    tx.room.findFirst
      .mockResolvedValueOnce({
        members: [{ role: "EDITOR" }],
      })
      .mockResolvedValueOnce({
        currentRevision: 8n,
      })

    await expect(
      service.updateObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 3,
        patch: {
          x: 130,
        },
      }),
    ).rejects.toMatchObject({
      response: {
        code: "OBJECT_VERSION_CONFLICT",
        details: {
          currentRoomRevision: 8,
          latestObject: expect.objectContaining({
            id: objectId,
            version: 4,
          }),
        },
      },
    })
    expect(tx.whiteboardObject.update).not.toHaveBeenCalled()
    expect(tx.whiteboardObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: objectId,
        roomId,
        deletedAt: null,
        version: 3,
      },
      data: expect.objectContaining({
        x: 130,
      }),
    })
    expectNoRevisionWrite()
  })

  it("rejects stale restores after a conditional write miss", async () => {
    tx.whiteboardObject.updateMany.mockResolvedValue({
      count: 0,
    })
    tx.whiteboardObject.findFirst
      .mockResolvedValueOnce(
        makeObject({
          deletedAt: now,
          version: 4,
        }),
      )
      .mockResolvedValueOnce(
        makeObject({
          deletedAt: now,
          version: 5,
        }),
      )
    tx.room.findFirst
      .mockResolvedValueOnce({
        members: [{ role: "EDITOR" }],
      })
      .mockResolvedValueOnce({
        currentRevision: 8n,
      })

    await expect(
      service.restoreObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 4,
      }),
    ).rejects.toMatchObject({
      response: {
        code: "OBJECT_VERSION_CONFLICT",
        details: {
          currentRoomRevision: 8,
          latestObject: expect.objectContaining({
            id: objectId,
            version: 5,
          }),
        },
      },
    })
    expect(tx.whiteboardObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: objectId,
        roomId,
        deletedAt: {
          not: null,
        },
        version: 4,
      },
      data: expect.objectContaining({
        deletedAt: null,
      }),
    })
    expectNoRevisionWrite()
  })

  it("rejects updates to soft-deleted objects before writing", async () => {
    tx.whiteboardObject.findFirst.mockResolvedValue(
      makeObject({
        deletedAt: now,
      }),
    )

    await expect(
      service.updateObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 3,
        patch: {
          x: 130,
        },
      }),
    ).rejects.toThrow(ConflictException)
    expect(tx.whiteboardObject.update).not.toHaveBeenCalled()
    expect(tx.whiteboardObject.updateMany).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })

  it("rejects deletes against an object deleted by a concurrent operation", async () => {
    tx.whiteboardObject.updateMany.mockResolvedValue({
      count: 0,
    })
    tx.whiteboardObject.findFirst
      .mockResolvedValueOnce(makeObject())
      .mockResolvedValueOnce(
        makeObject({
          deletedAt: now,
          version: 4,
        }),
      )

    await expect(
      service.deleteObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 3,
      }),
    ).rejects.toMatchObject({
      response: {
        code: "OBJECT_ALREADY_DELETED",
      },
    })
    expect(tx.whiteboardObject.update).not.toHaveBeenCalled()
    expect(tx.whiteboardObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: objectId,
        roomId,
        deletedAt: null,
        version: 3,
      },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
      }),
    })
    expectNoRevisionWrite()
  })

  it.each([
    [["roomId", "clientOpId"]],
    ["WhiteboardOperation_roomId_clientOpId_key"],
  ])(
    "rejects duplicate operation ids that race at the database constraint",
    async (target) => {
      tx.whiteboardObject.create.mockResolvedValue(makeObject({ version: 1 }))
      tx.whiteboardOperation.create.mockRejectedValue({
        code: "P2002",
        meta: {
          target,
        },
      })

      await expect(
        service.createObject(currentUser, roomId, {
          clientOpId,
          object: {
            type: "RECTANGLE",
            x: 100,
            y: 200,
            width: 160,
            height: 96,
          },
        }),
      ).rejects.toMatchObject({
        response: {
          code: "DUPLICATE_OPERATION",
        },
      })
      expectMutationTransactionUsed()
      expect(tx.whiteboardOperation.findUnique).toHaveBeenCalledWith({
        where: {
          roomId_clientOpId: {
            roomId,
            clientOpId,
          },
        },
        select: {
          id: true,
        },
      })
      expectRoomRevisionIncrementedOnce()
      expect(tx.whiteboardOperation.create).toHaveBeenCalledTimes(1)
    },
  )

  it("rejects duplicate client operation ids", async () => {
    tx.whiteboardOperation.findUnique.mockResolvedValue({
      id: operationId,
    })

    await expect(
      service.deleteObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 3,
      }),
    ).rejects.toThrow(ConflictException)
    expect(tx.whiteboardObject.findFirst).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })

  it("rejects duplicate client operation ids for restore", async () => {
    tx.whiteboardOperation.findUnique.mockResolvedValue({
      id: operationId,
    })

    await expect(
      service.restoreObject(currentUser, roomId, objectId, {
        clientOpId,
        baseObjectVersion: 4,
      }),
    ).rejects.toThrow(ConflictException)
    expect(tx.whiteboardObject.findFirst).not.toHaveBeenCalled()
    expectNoRevisionWrite()
  })
})
