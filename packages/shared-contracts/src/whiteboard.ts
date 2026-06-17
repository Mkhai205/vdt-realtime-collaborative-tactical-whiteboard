import { z } from "zod"
import { userSummarySchema } from "./user"

export const objectTypeSchema = z.enum(["RECTANGLE", "CIRCLE", "LINE", "TEXT"])
export const toolSchema = z.enum([
  "SELECT",
  "HAND",
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "TEXT",
])
export const operationTypeSchema = z.enum([
  "OBJECT_CREATE",
  "OBJECT_UPDATE",
  "OBJECT_DELETE",
  "OBJECT_RESTORE",
])
export const operationRejectedReasonSchema = z.enum([
  "PERMISSION_DENIED",
  "BOARD_NOT_FOUND",
  "USER_NOT_IN_BOARD",
  "OBJECT_NOT_FOUND",
  "OBJECT_ALREADY_DELETED",
  "OBJECT_VERSION_CONFLICT",
  "INVALID_OPERATION_PAYLOAD",
  "DUPLICATE_OPERATION",
  "INTERNAL_ERROR",
])

export const shapeStyleSchema = z
  .object({
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    opacity: z.number().min(0).max(1).optional(),
    fontSize: z.number().positive().optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    color: z.string().optional(),
    arrowStart: z.boolean().optional(),
    arrowEnd: z.boolean().optional(),
  })
  .catchall(z.unknown())

export const whiteboardObjectSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  type: objectTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  points: z.array(z.number()).nullable().optional(),
  text: z.string().nullable().optional(),
  rotation: z.number(),
  style: shapeStyleSchema,
  zIndex: z.number().int(),
  version: z.number().int().positive(),
  createdById: z.uuid(),
  updatedById: z.uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
})

export const linePointsSchema = z
  .array(z.number())
  .length(4, "Line objects require exactly four point coordinates.")

export const clientOpIdSchema = z.string().trim().min(1).max(120)

export const objectMutablePatchSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  points: linePointsSchema.optional(),
  text: z.string().optional(),
  rotation: z.number().optional(),
  style: shapeStyleSchema.optional(),
  zIndex: z.number().int().optional(),
})

export const nonEmptyObjectMutablePatchSchema = objectMutablePatchSchema.refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one mutable object field is required.",
  },
)

export const objectCreateInputSchema = z
  .object({
    type: objectTypeSchema,
    x: z.number(),
    y: z.number(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    points: linePointsSchema.optional(),
    text: z.string().max(5000).optional(),
    rotation: z.number().optional(),
    style: shapeStyleSchema.optional(),
    zIndex: z.number().int().optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.type === "RECTANGLE" || value.type === "CIRCLE") &&
      (value.width === undefined || value.height === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Rectangle and circle objects require width and height.",
        path: ["width"],
      })
    }

    if (value.type === "LINE" && !value.points) {
      context.addIssue({
        code: "custom",
        message: "Line objects require points.",
        path: ["points"],
      })
    }

    if (value.type === "TEXT" && value.text === undefined) {
      context.addIssue({
        code: "custom",
        message: "Text objects require text.",
        path: ["text"],
      })
    }
  })

export const objectCreateRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  baseRoomRevision: z.number().int().nonnegative().optional(),
  object: objectCreateInputSchema,
})

export const objectUpdateRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  baseRoomRevision: z.number().int().nonnegative().optional(),
  baseObjectVersion: z.number().int().positive(),
  patch: nonEmptyObjectMutablePatchSchema,
})

export const objectDeleteRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  baseRoomRevision: z.number().int().nonnegative().optional(),
  baseObjectVersion: z.number().int().positive(),
})

export const objectRestoreRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  baseRoomRevision: z.number().int().nonnegative().optional(),
  baseObjectVersion: z.number().int().positive(),
})

export const objectCreateSocketRequestSchema = objectCreateRequestSchema.extend(
  {
    boardId: z.uuid(),
  },
)

export const objectUpdateSocketRequestSchema = objectUpdateRequestSchema.extend(
  {
    boardId: z.uuid(),
    objectId: z.uuid(),
  },
)

export const objectDeleteSocketRequestSchema = objectDeleteRequestSchema.extend(
  {
    boardId: z.uuid(),
    objectId: z.uuid(),
  },
)

export const objectRestoreSocketRequestSchema =
  objectRestoreRequestSchema.extend({
    boardId: z.uuid(),
    objectId: z.uuid(),
  })

export const objectCreateOperationSchema = z.object({
  type: z.literal("OBJECT_CREATE"),
  baseRoomRevision: z.number().int().nonnegative().optional(),
  object: objectCreateInputSchema,
})

export const objectUpdateOperationSchema = z.object({
  type: z.literal("OBJECT_UPDATE"),
  objectId: z.uuid(),
  baseRoomRevision: z.number().int().nonnegative().optional(),
  baseObjectVersion: z.number().int().positive(),
  patch: nonEmptyObjectMutablePatchSchema,
})

export const objectDeleteOperationSchema = z.object({
  type: z.literal("OBJECT_DELETE"),
  objectId: z.uuid(),
  baseRoomRevision: z.number().int().nonnegative().optional(),
  baseObjectVersion: z.number().int().positive(),
})

export const objectRestoreOperationSchema = z.object({
  type: z.literal("OBJECT_RESTORE"),
  objectId: z.uuid(),
  baseRoomRevision: z.number().int().nonnegative().optional(),
  baseObjectVersion: z.number().int().positive(),
})

export const undoRedoOperationSchema = z.discriminatedUnion("type", [
  objectCreateOperationSchema,
  objectUpdateOperationSchema,
  objectDeleteOperationSchema,
  objectRestoreOperationSchema,
])

export const undoRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  inverseOperation: undoRedoOperationSchema,
})

export const redoRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  redoOperation: undoRedoOperationSchema,
})

export const getBoardObjectsResponseSchema = z.object({
  boardId: z.uuid(),
  currentRevision: z.number().int().nonnegative(),
  objects: z.array(whiteboardObjectSchema),
})
/** @deprecated use getBoardObjectsResponseSchema */
export const getRoomObjectsResponseSchema = getBoardObjectsResponseSchema

export const getBoardOperationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .default(50)
    .transform((limit) => Math.min(limit, 100)),
})
/** @deprecated use getBoardOperationsQuerySchema */
export const getRoomOperationsQuerySchema = getBoardOperationsQuerySchema

export const operationSummarySchema = z.object({
  id: z.uuid(),
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  actor: userSummarySchema,
  objectId: z.uuid().nullable().optional(),
  objectType: objectTypeSchema.nullable(),
  revision: z.number().int().nonnegative(),
  type: operationTypeSchema,
  summary: z.string().min(1),
  createdAt: z.string(),
})

export const getBoardOperationsResponseSchema = z.object({
  boardId: z.uuid(),
  operations: z.array(operationSummarySchema),
})
/** @deprecated use getBoardOperationsResponseSchema */
export const getRoomOperationsResponseSchema = getBoardOperationsResponseSchema

export const operationAppliedEventSchema = z.object({
  operationId: z.uuid(),
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  revision: z.number().int().nonnegative(),
  type: operationTypeSchema,
  objectId: z.uuid().nullable().optional(),
  actor: userSummarySchema,
  payload: z.unknown(),
  resultingObject: whiteboardObjectSchema.nullable().optional(),
  createdAt: z.string(),
})

export const operationRejectedEventSchema = z.object({
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  reason: operationRejectedReasonSchema,
  message: z.string().min(1),
  latestObject: whiteboardObjectSchema.nullable().optional(),
  currentBoardRevision: z.number().int().nonnegative().optional(),
})

export const whiteboardObjectParamsSchema = z.object({
  boardId: z.uuid(),
  objectId: z.uuid(),
})

export type ObjectType = z.infer<typeof objectTypeSchema>
export type Tool = z.infer<typeof toolSchema>
export type OperationType = z.infer<typeof operationTypeSchema>
export type OperationRejectedReason = z.infer<
  typeof operationRejectedReasonSchema
>
export type ShapeStyle = z.infer<typeof shapeStyleSchema>
export type WhiteboardObject = z.infer<typeof whiteboardObjectSchema>
export type ObjectMutablePatch = z.infer<typeof objectMutablePatchSchema>
export type ObjectCreateInput = z.infer<typeof objectCreateInputSchema>
export type ObjectCreateRequest = z.infer<typeof objectCreateRequestSchema>
export type ObjectUpdateRequest = z.infer<typeof objectUpdateRequestSchema>
export type ObjectDeleteRequest = z.infer<typeof objectDeleteRequestSchema>
export type ObjectRestoreRequest = z.infer<typeof objectRestoreRequestSchema>
export type ObjectCreateSocketRequest = z.infer<
  typeof objectCreateSocketRequestSchema
>
export type ObjectUpdateSocketRequest = z.infer<
  typeof objectUpdateSocketRequestSchema
>
export type ObjectDeleteSocketRequest = z.infer<
  typeof objectDeleteSocketRequestSchema
>
export type ObjectRestoreSocketRequest = z.infer<
  typeof objectRestoreSocketRequestSchema
>
export type ObjectCreateOperation = z.infer<typeof objectCreateOperationSchema>
export type ObjectUpdateOperation = z.infer<typeof objectUpdateOperationSchema>
export type ObjectDeleteOperation = z.infer<typeof objectDeleteOperationSchema>
export type ObjectRestoreOperation = z.infer<
  typeof objectRestoreOperationSchema
>
export type UndoRedoOperation = z.infer<typeof undoRedoOperationSchema>
export type UndoRequest = z.infer<typeof undoRequestSchema>
export type RedoRequest = z.infer<typeof redoRequestSchema>

// Board-prefixed types (canonical)
export type GetBoardObjectsResponse = z.infer<
  typeof getBoardObjectsResponseSchema
>
export type GetBoardOperationsQuery = z.infer<
  typeof getBoardOperationsQuerySchema
>
export type GetBoardOperationsResponse = z.infer<
  typeof getBoardOperationsResponseSchema
>

// Room-prefixed aliases for backward compat
/** @deprecated use GetBoardObjectsResponse */
export type GetRoomObjectsResponse = GetBoardObjectsResponse
/** @deprecated use GetBoardOperationsQuery */
export type GetRoomOperationsQuery = GetBoardOperationsQuery
/** @deprecated use GetBoardOperationsResponse */
export type GetRoomOperationsResponse = GetBoardOperationsResponse

export type OperationSummary = z.infer<typeof operationSummarySchema>
export type OperationAppliedEvent = z.infer<typeof operationAppliedEventSchema>
export type OperationRejectedEvent = z.infer<
  typeof operationRejectedEventSchema
>
export type WhiteboardObjectParams = z.infer<
  typeof whiteboardObjectParamsSchema
>
