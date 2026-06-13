import { InternalServerErrorException, NotFoundException } from "@nestjs/common"
import { Prisma } from "@rctw/database"
import { PrismaService } from "../../infrastructure/database"
import { WhiteboardSnapshotsService } from "./whiteboard-snapshots.service"

const roomId = "11111111-1111-4111-8111-111111111111"
const userId = "33333333-3333-4333-8333-333333333333"
const snapshotId = "77777777-7777-4777-8777-777777777777"
const now = new Date("2026-06-09T00:00:00.000Z")

function makeObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
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

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: snapshotId,
    roomId,
    revision: 7n,
    data: {
      objects: [makeObject()],
    },
    createdAt: now,
    ...overrides,
  }
}

describe("WhiteboardSnapshotsService", () => {
  const tx = {
    room: {
      findFirst: jest.fn(),
    },
    roomSnapshot: {
      createMany: jest.fn(),
      findUnique: jest.fn(),
    },
    whiteboardObject: {
      findMany: jest.fn(),
    },
  }
  const prismaClient = {
    $transaction: jest.fn(),
  }
  let service: WhiteboardSnapshotsService

  function expectRepeatableReadTransactionUsed() {
    expect(prismaClient.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()

    prismaClient.$transaction.mockImplementation(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
    )
    tx.room.findFirst.mockResolvedValue({
      currentRevision: 7n,
    })
    tx.roomSnapshot.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeSnapshot())
    tx.roomSnapshot.createMany.mockResolvedValue({
      count: 1,
    })
    tx.whiteboardObject.findMany.mockResolvedValue([makeObject()])

    service = new WhiteboardSnapshotsService(
      prismaClient as unknown as PrismaService,
    )
  })

  it("creates a room snapshot for the current room revision", async () => {
    const response = await service.createSnapshot(roomId)

    expect(tx.room.findFirst).toHaveBeenCalledWith({
      where: {
        id: roomId,
        deletedAt: null,
      },
      select: {
        currentRevision: true,
      },
    })
    expect(tx.roomSnapshot.findUnique).toHaveBeenCalledWith({
      where: {
        roomId_revision: {
          roomId,
          revision: 7n,
        },
      },
    })
    expect(tx.roomSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          roomId,
          revision: 7n,
          data: {
            objects: [
              expect.objectContaining({
                id: "22222222-2222-4222-8222-222222222222",
                deletedAt: null,
                createdAt: now.toISOString(),
              }),
            ],
          },
        },
      ],
      skipDuplicates: true,
    })
    expectRepeatableReadTransactionUsed()
    expect(response).toEqual({
      id: snapshotId,
      roomId,
      revision: 7,
      data: {
        objects: [expect.objectContaining({ id: expect.any(String) })],
      },
      createdAt: now.toISOString(),
    })
  })

  it("loads active room objects in stable render order", async () => {
    await service.createSnapshot(roomId)

    expect(tx.whiteboardObject.findMany).toHaveBeenCalledWith({
      where: {
        roomId,
        deletedAt: null,
      },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    })
  })

  it("stores active objects only", async () => {
    await service.createSnapshot(roomId)

    expect(tx.whiteboardObject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          roomId,
          deletedAt: null,
        },
      }),
    )
    expect(tx.roomSnapshot.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            data: {
              objects: [
                expect.not.objectContaining({
                  deletedAt: expect.any(String),
                }),
              ],
            },
          }),
        ],
      }),
    )
  })

  it("returns an existing snapshot for the same room revision", async () => {
    tx.roomSnapshot.findUnique.mockReset()
    tx.roomSnapshot.findUnique.mockResolvedValue(makeSnapshot())

    const response = await service.createSnapshot(roomId)

    expect(response.id).toBe(snapshotId)
    expect(response.revision).toBe(7)
    expect(tx.whiteboardObject.findMany).not.toHaveBeenCalled()
    expect(tx.roomSnapshot.createMany).not.toHaveBeenCalled()
  })

  it("rejects missing or soft-deleted rooms", async () => {
    tx.room.findFirst.mockResolvedValue(null)

    await expect(service.createSnapshot(roomId)).rejects.toThrow(
      NotFoundException,
    )
    expect(tx.roomSnapshot.findUnique).not.toHaveBeenCalled()
    expect(tx.whiteboardObject.findMany).not.toHaveBeenCalled()
    expect(tx.roomSnapshot.createMany).not.toHaveBeenCalled()
  })

  it("fails clearly if an inserted snapshot cannot be reloaded", async () => {
    tx.roomSnapshot.findUnique.mockReset()
    tx.roomSnapshot.findUnique.mockResolvedValue(null)

    await expect(service.createSnapshot(roomId)).rejects.toThrow(
      InternalServerErrorException,
    )
    expect(tx.roomSnapshot.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      }),
    )
  })
})
