import {
  operationTypeSchema,
  objectTypeSchema,
  shapeStyleSchema,
  type ObjectType,
  type OperationAppliedEvent,
  type OperationSummary,
  type OperationType,
  type ShapeStyle,
  type UserSummary,
  type WhiteboardObject,
} from "@rctw/shared-contracts"

type TimestampValue = Date | string

export type WhiteboardObjectRecord = {
  id: string
  boardId: string
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
  boardId: string
  objectId?: string | null
  revision: bigint | number
  type: string
  createdAt: TimestampValue
}

export type WhiteboardOperationSummaryRecord = WhiteboardOperationRecord & {
  actor: UserSummary
  payload: unknown
  object?: {
    type?: string | null
  } | null
}

export function toWhiteboardObject(
  object: WhiteboardObjectRecord,
): WhiteboardObject {
  return {
    id: object.id,
    boardId: object.boardId,
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

export function toOperationSummary(
  operation: WhiteboardOperationSummaryRecord,
): OperationSummary {
  const type = toOperationType(operation.type)
  const objectType = toSummaryObjectType(operation)

  return {
    id: operation.id,
    clientOpId: operation.clientOpId,
    boardId: operation.boardId,
    actor: operation.actor,
    objectId: operation.objectId ?? null,
    objectType,
    revision: Number(operation.revision),
    type,
    summary: createOperationSummary(type, objectType, operation.payload),
    createdAt: toIsoString(operation.createdAt),
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
    boardId: operation.boardId,
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

function toSummaryObjectType(
  operation: WhiteboardOperationSummaryRecord,
): ObjectType | null {
  return (
    toOptionalObjectType(operation.object?.type) ??
    getPayloadObjectType(operation.payload)
  )
}

function getPayloadObjectType(payload: unknown): ObjectType | null {
  if (!isRecord(payload)) {
    return null
  }

  for (const key of [
    "object",
    "resultingObject",
    "previousObject",
    "restoredObject",
  ]) {
    const value = payload[key]

    if (isRecord(value)) {
      const objectType = toOptionalObjectType(value.type)

      if (objectType) {
        return objectType
      }
    }
  }

  return null
}

function toOptionalObjectType(value: unknown): ObjectType | null {
  const parsed = objectTypeSchema.safeParse(value)

  return parsed.success ? parsed.data : null
}

function createOperationSummary(
  type: OperationType,
  objectType: ObjectType | null,
  payload: unknown,
): string {
  const objectLabel = objectType ? formatObjectType(objectType) : "object"

  switch (type) {
    case "OBJECT_CREATE":
      return `Created ${objectLabel}`
    case "OBJECT_UPDATE":
      return `Updated ${objectLabel}${formatPatchSummary(payload)}`
    case "OBJECT_DELETE":
      return `Deleted ${objectLabel}`
    case "OBJECT_RESTORE":
      return `Restored ${objectLabel}`
  }
}

function formatObjectType(objectType: ObjectType): string {
  return objectType.toLowerCase()
}

function formatPatchSummary(payload: unknown): string {
  if (!isRecord(payload) || !isRecord(payload.patch)) {
    return ""
  }

  const fields = Object.keys(payload.patch)

  if (fields.length === 0) {
    return ""
  }

  return `: ${fields.map(formatPatchField).join(", ")}`
}

function formatPatchField(field: string): string {
  switch (field) {
    case "zIndex":
      return "z index"
    default:
      return field
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
