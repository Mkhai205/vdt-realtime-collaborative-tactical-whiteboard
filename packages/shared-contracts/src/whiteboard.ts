import { z } from "zod"

export const objectTypeSchema = z.enum(["RECTANGLE", "CIRCLE", "LINE", "TEXT"])
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
  roomId: z.uuid(),
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

export const objectMutablePatchSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  points: z.array(z.number()).optional(),
  text: z.string().optional(),
  rotation: z.number().optional(),
  style: shapeStyleSchema.optional(),
  zIndex: z.number().int().optional(),
})

export type ObjectType = z.infer<typeof objectTypeSchema>
export type OperationType = z.infer<typeof operationTypeSchema>
export type ShapeStyle = z.infer<typeof shapeStyleSchema>
export type WhiteboardObject = z.infer<typeof whiteboardObjectSchema>
export type ObjectMutablePatch = z.infer<typeof objectMutablePatchSchema>
