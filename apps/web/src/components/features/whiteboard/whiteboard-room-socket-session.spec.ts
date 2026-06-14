/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest"
import type { OperationAppliedEvent, OperationRejectedEvent } from "@rctw/shared-contracts"
import { WhiteboardRoomSocketSession, type WhiteboardStoreActions } from "./whiteboard-room-socket-session"
import type { WhiteboardSocket } from "@/lib/socket-client"

describe("WhiteboardRoomSocketSession", () => {
  let mockSocket: any
  let mockActions: Mocked<WhiteboardStoreActions>
  let session: WhiteboardRoomSocketSession
  const roomId = "test-room-id"

  beforeEach(() => {
    mockSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      connected: true,
      active: true,
    }

    mockActions = {
      setRoomId: vi.fn(),
      setLoadedRoomState: vi.fn(),
      setObjectsWithRevision: vi.fn(),
      setConnectionStatus: vi.fn(),
      setSocketError: vi.fn(),
      setOnlineUsers: vi.fn(),
      setObjectOperationSender: vi.fn(),
      setTransformPreviewSender: vi.fn(),
      setCursorSender: vi.fn(),
      setEditingSender: vi.fn(),
      setSelectionSender: vi.fn(),
      applyOperation: vi.fn(),
      markRevisionSynced: vi.fn(),
      applyOperationRejection: vi.fn(),
      applyRemoteTransformPreview: vi.fn(),
      applyRemoteCursor: vi.fn(),
      applyRemoteEditing: vi.fn(),
      getLastSeenRevision: vi.fn(() => 42),
    } as any

    session = new WhiteboardRoomSocketSession(mockSocket as WhiteboardSocket, roomId, mockActions)
  })

  it("registers actions and connects to socket", () => {
    session.connect()

    expect(mockActions.setRoomId).toHaveBeenCalledWith(roomId)
    expect(mockActions.setConnectionStatus).toHaveBeenCalledWith("connecting")
    expect(mockSocket.connect).toHaveBeenCalled()
    expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function))
  })

  it("emits room:join on connect if not previously loaded", () => {
    session.connect()
    
    // Find the connect handler registered on socket.on
    const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === "connect")[1]
    connectHandler()

    expect(mockSocket.emit).toHaveBeenCalledWith("room:join", { roomId })
  })

  it("emits sync:request on connect if state was previously loaded", () => {
    session.hasLoadedInitialRoomState = true
    session.connect()
    
    const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === "connect")[1]
    connectHandler()

    expect(mockSocket.emit).toHaveBeenCalledWith("sync:request", {
      roomId,
      lastSeenRevision: 42,
    })
  })

  it("handles operation applied events, matching and resolving pending operations", async () => {
    session.connect()
    const sender = session.createOperationSender()

    const createPromise = sender.createObject({
      roomId,
      clientOpId: "op-1",
      baseRoomRevision: 1,
      object: {} as any,
    })

    // Find the operation:applied handler
    const appliedHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === "operation:applied")[1]

    const appliedEvent: OperationAppliedEvent = {
      operationId: "op-id",
      clientOpId: "op-1",
      roomId,
      revision: 2,
      type: "OBJECT_CREATE",
      actor: { id: "user-1", name: "User 1", avatarColor: "#000" },
      payload: {},
      createdAt: new Date().toISOString(),
    }

    appliedHandler(appliedEvent)

    const resolvedValue = await createPromise
    expect(resolvedValue).toEqual(appliedEvent)
    expect(mockActions.applyOperation).toHaveBeenCalledWith(appliedEvent, {
      removeObjectId: undefined,
      historyCandidate: undefined,
    })
  })

  it("handles operation rejection events, matching and rejecting pending operations", async () => {
    session.connect()
    const sender = session.createOperationSender()

    const createPromise = sender.createObject({
      roomId,
      clientOpId: "op-1",
      baseRoomRevision: 1,
      object: {} as any,
    })

    const rejectedHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === "operation:rejected")[1]

    const rejectedEvent: OperationRejectedEvent = {
      clientOpId: "op-1",
      roomId,
      reason: "OBJECT_VERSION_CONFLICT",
      message: "Version mismatch",
    }

    rejectedHandler(rejectedEvent)

    await expect(createPromise).rejects.toEqual(rejectedEvent)
    expect(mockActions.applyOperationRejection).not.toHaveBeenCalled() // handled by promise reject
  })
})
