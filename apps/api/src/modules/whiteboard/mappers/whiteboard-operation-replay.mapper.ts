import {
  whiteboardObjectSchema,
  type OperationAppliedEvent,
  type UserSummary,
  type WhiteboardObject,
} from "@rctw/shared-contracts"
import { toOperationAppliedEvent } from "./whiteboard-object-response.mapper"

export type OperationReplayRecord = {
  id: string
  clientOpId: string
  boardId: string
  objectId?: string | null
  revision: bigint | number
  type: string
  payload: unknown
  createdAt: Date | string
  actor: UserSummary
}

export function toOperationReplayEvent(
  operation: OperationReplayRecord,
): OperationAppliedEvent {
  return toOperationAppliedEvent({
    operation,
    actor: operation.actor,
    payload: operation.payload,
    resultingObject: getReplayResultingObject(
      operation.type,
      operation.payload,
    ),
  })
}

function getReplayResultingObject(
  operationType: string,
  payload: unknown,
): WhiteboardObject | null {
  if (operationType === "OBJECT_DELETE" || !isRecord(payload)) {
    return null
  }

  const payloadKey =
    operationType === "OBJECT_CREATE" ? "object" : "resultingObject"
  const parsed = whiteboardObjectSchema.safeParse(payload[payloadKey])

  return parsed.success ? parsed.data : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
