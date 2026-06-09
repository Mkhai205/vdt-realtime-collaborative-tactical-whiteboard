import { z } from "zod"
import { userSummarySchema } from "./common.js"

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

export const shapeStyleSchema = z
  .object({
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().finite().nonnegative().optional(),
    opacity: z.number().finite().min(0).max(1).optional(),
    fontSize: z.number().finite().positive().optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    color: z.string().optional(),
    arrowStart: z.boolean().optional(),
    arrowEnd: z.boolean().optional(),
  })
  .catchall(z.unknown())

export const whiteboardObjectSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  type: objectTypeSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nullable().optional(),
  height: z.number().finite().nullable().optional(),
  points: z.array(z.number().finite()).nullable().optional(),
  text: z.string().nullable().optional(),
  rotation: z.number().finite(),
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
  .array(z.number().finite())
  .length(4, "Line objects require exactly four point coordinates.")

export const clientOpIdSchema = z.string().trim().min(1).max(120)

export const objectMutablePatchSchema = z.object({
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
  points: linePointsSchema.optional(),
  text: z.string().optional(),
  rotation: z.number().finite().optional(),
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
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive().optional(),
    height: z.number().finite().positive().optional(),
    points: linePointsSchema.optional(),
    text: z.string().max(5000).optional(),
    rotation: z.number().finite().optional(),
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

export const getRoomObjectsResponseSchema = z.object({
  roomId: z.uuid(),
  currentRevision: z.number().int().nonnegative(),
  objects: z.array(whiteboardObjectSchema),
})

export const operationAppliedEventSchema = z.object({
  operationId: z.uuid(),
  clientOpId: clientOpIdSchema,
  roomId: z.uuid(),
  revision: z.number().int().nonnegative(),
  type: operationTypeSchema,
  objectId: z.uuid().nullable().optional(),
  actor: userSummarySchema,
  payload: z.unknown(),
  resultingObject: whiteboardObjectSchema.nullable().optional(),
  createdAt: z.string(),
})

export const whiteboardObjectParamsSchema = z.object({
  roomId: z.uuid(),
  objectId: z.uuid(),
})

export type ObjectType = z.infer<typeof objectTypeSchema>
export type Tool = z.infer<typeof toolSchema>
export type OperationType = z.infer<typeof operationTypeSchema>
export type ShapeStyle = z.infer<typeof shapeStyleSchema>
export type WhiteboardObject = z.infer<typeof whiteboardObjectSchema>
export type ObjectMutablePatch = z.infer<typeof objectMutablePatchSchema>
export type ObjectCreateInput = z.infer<typeof objectCreateInputSchema>
export type ObjectCreateRequest = z.infer<typeof objectCreateRequestSchema>
export type ObjectUpdateRequest = z.infer<typeof objectUpdateRequestSchema>
export type ObjectDeleteRequest = z.infer<typeof objectDeleteRequestSchema>
export type GetRoomObjectsResponse = z.infer<
  typeof getRoomObjectsResponseSchema
>
export type OperationAppliedEvent = z.infer<typeof operationAppliedEventSchema>
export type WhiteboardObjectParams = z.infer<
  typeof whiteboardObjectParamsSchema
>
