import { ConflictException } from "@nestjs/common"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import { z } from "zod"
import {
  parseOperationRejectionContext,
  toOperationRejectedEvent,
  toSocketError,
  toValidationSocketError,
} from "./realtime-socket-errors"

const roomId = "11111111-1111-4111-8111-111111111111"
const objectId = "22222222-2222-4222-8222-222222222222"
const clientOpId = "33333333-3333-4333-8333-333333333333"
const now = "2026-06-06T00:00:00.000Z"

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
  version: 2,
  createdById: "44444444-4444-4444-8444-444444444444",
  updatedById: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}

describe("realtime socket error helpers", () => {
  it("builds socket validation errors from Zod failures", () => {
    const schema = z.object({
      roomId: z.uuid(),
    })
    const parsed = schema.safeParse({
      roomId: "not-a-room-id",
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) {
      throw new Error("Expected validation to fail")
    }

    expect(toValidationSocketError(parsed.error)).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid socket payload.",
      details: expect.any(Object),
    })
  })

  it("parses operation rejection context from partially invalid payloads", () => {
    expect(
      parseOperationRejectionContext({
        roomId,
        clientOpId,
        unexpected: true,
      }),
    ).toEqual({
      roomId,
      clientOpId,
    })
  })

  it("maps object version conflicts to operation rejections with conflict details", () => {
    const event = toOperationRejectedEvent(
      new ConflictException({
        code: "OBJECT_VERSION_CONFLICT",
        message: "Whiteboard object has changed since your last edit.",
        details: {
          latestObject: whiteboardObject,
          currentRoomRevision: 9,
        },
      }),
      {
        roomId,
        clientOpId,
      },
      jest.fn(),
    )

    expect(event).toEqual({
      roomId,
      clientOpId,
      reason: "OBJECT_VERSION_CONFLICT",
      message: "Whiteboard object has changed since your last edit.",
      latestObject: whiteboardObject,
      currentRoomRevision: 9,
    })
  })

  it("logs unexpected errors and returns a generic socket error", () => {
    const logUnexpectedError = jest.fn()

    expect(toSocketError(new Error("boom"), logUnexpectedError)).toEqual({
      code: "INTERNAL_ERROR",
      message: "Unexpected realtime server error.",
    })
    expect(logUnexpectedError).toHaveBeenCalledWith(
      "Unexpected realtime error",
      expect.any(Error),
    )
  })
})
