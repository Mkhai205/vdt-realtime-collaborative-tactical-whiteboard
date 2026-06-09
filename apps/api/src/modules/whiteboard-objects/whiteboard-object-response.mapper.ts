import {
  operationTypeSchema,
  objectTypeSchema,
  shapeStyleSchema,
  type OperationAppliedEvent,
  type OperationType,
  type ShapeStyle,
  type UserSummary,
  type WhiteboardObject,
} from "@rctw/shared-contracts"

type TimestampValue = Date | string

export type WhiteboardObjectRecord = {
  id: string
  roomId: string
  type: string
  x: number
  y: number
  width?: number | null
  height?: number | null
  points?: unknown
  text?: string | null
  rotation: number
  style: unknown
  zIndex: number
  version: number
  createdById: string
  updatedById?: string | null
  createdAt: TimestampValue
  updatedAt: TimestampValue
  deletedAt?: TimestampValue | null
}

export type WhiteboardOperationRecord = {
  id: string
  clientOpId: string
  roomId: string
  objectId?: string | null
  revision: bigint | number
  type: string
  createdAt: TimestampValue
}

export function toWhiteboardObject(
  object: WhiteboardObjectRecord,
): WhiteboardObject {
  return {
    id: object.id,
    roomId: object.roomId,
    type: toObjectType(object.type),
    x: object.x,
    y: object.y,
    width: object.width ?? null,
    height: object.height ?? null,
    points: toPoints(object.points),
    text: object.text ?? null,
    rotation: object.rotation,
    style: toShapeStyle(object.style),
    zIndex: object.zIndex,
    version: object.version,
    createdById: object.createdById,
    updatedById: object.updatedById ?? null,
    createdAt: toIsoString(object.createdAt),
    updatedAt: toIsoString(object.updatedAt),
    deletedAt: object.deletedAt ? toIsoString(object.deletedAt) : null,
  }
}

export function toShapeStyle(value: unknown): ShapeStyle {
  const parsed = shapeStyleSchema.safeParse(value)

  return parsed.success ? parsed.data : {}
}

export function toOperationAppliedEvent({
  operation,
  actor,
  payload,
  resultingObject,
}: {
  operation: WhiteboardOperationRecord
  actor: UserSummary
  payload: unknown
  resultingObject?: WhiteboardObject | null
}): OperationAppliedEvent {
  return {
    operationId: operation.id,
    clientOpId: operation.clientOpId,
    roomId: operation.roomId,
    revision: Number(operation.revision),
    type: toOperationType(operation.type),
    objectId: operation.objectId ?? null,
    actor,
    payload,
    resultingObject: resultingObject ?? null,
    createdAt: toIsoString(operation.createdAt),
  }
}

function toObjectType(value: string): WhiteboardObject["type"] {
  return objectTypeSchema.catch("RECTANGLE").parse(value)
}

function toOperationType(value: string): OperationType {
  return operationTypeSchema.catch("OBJECT_UPDATE").parse(value)
}

function toPoints(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const points = value.filter((point): point is number =>
    Number.isFinite(point),
  )

  return points.length > 0 ? points : null
}

function toIsoString(value: TimestampValue): string {
  return value instanceof Date ? value.toISOString() : value
}
