import type {
  ObjectCreateRequest,
  ObjectDeleteRequest,
  ObjectUpdateRequest,
  OperationAppliedEvent,
  UserSummary,
} from "@rctw/shared-contracts"
import { WhiteboardObjectsController } from "./whiteboard-objects.controller"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

describe("WhiteboardObjectsController", () => {
  const roomId = "11111111-1111-4111-8111-111111111111"
  const objectId = "22222222-2222-4222-8222-222222222222"
  const userId = "33333333-3333-4333-8333-333333333333"
  const currentUser: UserSummary = {
    id: userId,
    name: "Editor",
    avatarUrl: null,
    avatarColor: "#3B82F6",
  }
  const operation: OperationAppliedEvent = {
    operationId: "44444444-4444-4444-8444-444444444444",
    clientOpId: "55555555-5555-4555-8555-555555555555",
    roomId,
    revision: 1,
    type: "OBJECT_CREATE",
    objectId,
    actor: currentUser,
    payload: {},
    resultingObject: null,
    createdAt: "2026-06-09T00:00:00.000Z",
  }
  const whiteboardObjectsService = {
    createObject: jest.fn(),
    deleteObject: jest.fn(),
    getRoomObjects: jest.fn(),
    updateObject: jest.fn(),
  }
  let controller: WhiteboardObjectsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new WhiteboardObjectsController(
      whiteboardObjectsService as unknown as WhiteboardObjectsService,
    )
  })

  it("delegates object loading to the service", async () => {
    const response = {
      roomId,
      currentRevision: 1,
      objects: [],
    }
    whiteboardObjectsService.getRoomObjects.mockResolvedValue(response)

    await expect(
      controller.getRoomObjects(currentUser, { roomId }),
    ).resolves.toBe(response)
    expect(whiteboardObjectsService.getRoomObjects).toHaveBeenCalledWith(
      currentUser,
      roomId,
    )
  })

  it("delegates object creation to the service", async () => {
    const request: ObjectCreateRequest = {
      clientOpId: operation.clientOpId,
      object: {
        type: "RECTANGLE",
        x: 100,
        y: 200,
        width: 160,
        height: 96,
      },
    }
    whiteboardObjectsService.createObject.mockResolvedValue(operation)

    await expect(
      controller.createObject(currentUser, { roomId }, request),
    ).resolves.toBe(operation)
    expect(whiteboardObjectsService.createObject).toHaveBeenCalledWith(
      currentUser,
      roomId,
      request,
    )
  })

  it("delegates object updates to the service", async () => {
    const request: ObjectUpdateRequest = {
      clientOpId: operation.clientOpId,
      baseObjectVersion: 1,
      patch: {
        x: 120,
      },
    }
    whiteboardObjectsService.updateObject.mockResolvedValue({
      ...operation,
      type: "OBJECT_UPDATE",
    })

    await expect(
      controller.updateObject(currentUser, { roomId, objectId }, request),
    ).resolves.toMatchObject({
      type: "OBJECT_UPDATE",
    })
    expect(whiteboardObjectsService.updateObject).toHaveBeenCalledWith(
      currentUser,
      roomId,
      objectId,
      request,
    )
  })

  it("delegates object deletes to the service", async () => {
    const request: ObjectDeleteRequest = {
      clientOpId: operation.clientOpId,
      baseObjectVersion: 1,
    }
    whiteboardObjectsService.deleteObject.mockResolvedValue({
      ...operation,
      type: "OBJECT_DELETE",
    })

    await expect(
      controller.deleteObject(currentUser, { roomId, objectId }, request),
    ).resolves.toMatchObject({
      type: "OBJECT_DELETE",
    })
    expect(whiteboardObjectsService.deleteObject).toHaveBeenCalledWith(
      currentUser,
      roomId,
      objectId,
      request,
    )
  })
})
