import { z } from "zod"
import { userSummarySchema } from "./common.js"
import { defaultJoinRoleSchema } from "./room.js"
import { roomRoleSchema } from "./identity.js"
import {
  operationAppliedEventSchema,
  toolSchema,
  whiteboardObjectSchema,
} from "./whiteboard.js"

export const roomSocketPrefix = "room:"

export function toRoomSocketName(roomId: string): string {
  return `${roomSocketPrefix}${roomId}`
}

export const roomJoinRequestSchema = z.object({
  roomId: z.uuid(),
})

export const roomLeaveRequestSchema = roomJoinRequestSchema

export const syncRequestSchema = z.object({
  roomId: z.uuid(),
  lastSeenRevision: z.number().int().nonnegative(),
})

export const onlineUserSchema = userSummarySchema.extend({
  role: roomRoleSchema,
  status: z.literal("ONLINE"),
  selectedObjectId: z.uuid().nullable().optional(),
  connectedAt: z.string(),
})

export const roomStateEventSchema = z.object({
  room: z.object({
    id: z.uuid(),
    name: z.string().min(1).max(160),
    description: z.string().nullable().optional(),
    currentRevision: z.number().int().nonnegative(),
    isPublic: z.boolean(),
    defaultJoinRole: defaultJoinRoleSchema,
  }),
  currentUser: userSummarySchema.extend({
    role: roomRoleSchema,
  }),
  objects: z.array(whiteboardObjectSchema),
  onlineUsers: z.array(onlineUserSchema),
})

export const presenceUpdateEventSchema = z.object({
  roomId: z.uuid(),
  onlineUsers: z.array(onlineUserSchema),
})

export const selectionUpdateRequestSchema = z.object({
  roomId: z.uuid(),
  selectedObjectId: z.uuid().nullable(),
})

export const editingStartRequestSchema = z.object({
  roomId: z.uuid(),
  objectId: z.uuid(),
})

export const editingEndRequestSchema = editingStartRequestSchema

export const objectEditingEventSchema = editingStartRequestSchema.extend({
  user: userSummarySchema,
  status: z.enum(["STARTED", "ENDED"]),
  timestamp: z.string(),
})

export const cursorUpdateRequestSchema = z.object({
  roomId: z.uuid(),
  x: z.number(),
  y: z.number(),
  selectedObjectId: z.uuid().nullable().optional(),
  currentTool: toolSchema.optional(),
})

export const cursorUpdatedEventSchema = cursorUpdateRequestSchema.extend({
  user: userSummarySchema,
  timestamp: z.string(),
})

export const objectTransformPreviewPatchSchema = z
  .object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    rotation: z.number().optional(),
    points: z.array(z.number()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one transform preview field is required.",
  })

export const objectTransformPreviewRequestSchema = z.object({
  roomId: z.uuid(),
  objectId: z.uuid(),
  preview: objectTransformPreviewPatchSchema,
})

export const objectTransformPreviewedEventSchema =
  objectTransformPreviewRequestSchema.extend({
    user: userSummarySchema,
    timestamp: z.string(),
  })

export const syncOperationsResponseSchema = z.object({
  mode: z.literal("OPERATIONS"),
  roomId: z.uuid(),
  fromRevision: z.number().int().nonnegative(),
  toRevision: z.number().int().nonnegative(),
  operations: z.array(operationAppliedEventSchema),
})

export const syncFullStateResponseSchema = z.object({
  mode: z.literal("FULL_STATE"),
  roomId: z.uuid(),
  revision: z.number().int().nonnegative(),
  objects: z.array(whiteboardObjectSchema),
})

export const syncResponseSchema = z.discriminatedUnion("mode", [
  syncOperationsResponseSchema,
  syncFullStateResponseSchema,
])

export const socketErrorEventSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
})

export type RoomJoinRequest = z.infer<typeof roomJoinRequestSchema>
export type RoomLeaveRequest = z.infer<typeof roomLeaveRequestSchema>
export type SyncRequest = z.infer<typeof syncRequestSchema>
export type OnlineUser = z.infer<typeof onlineUserSchema>
export type RoomStateEvent = z.infer<typeof roomStateEventSchema>
export type PresenceUpdateEvent = z.infer<typeof presenceUpdateEventSchema>
export type SelectionUpdateRequest = z.infer<
  typeof selectionUpdateRequestSchema
>
export type EditingStartRequest = z.infer<typeof editingStartRequestSchema>
export type EditingEndRequest = z.infer<typeof editingEndRequestSchema>
export type ObjectEditingEvent = z.infer<typeof objectEditingEventSchema>
export type CursorUpdateRequest = z.infer<typeof cursorUpdateRequestSchema>
export type CursorUpdatedEvent = z.infer<typeof cursorUpdatedEventSchema>
export type ObjectTransformPreviewPatch = z.infer<
  typeof objectTransformPreviewPatchSchema
>
export type ObjectTransformPreviewRequest = z.infer<
  typeof objectTransformPreviewRequestSchema
>
export type ObjectTransformPreviewedEvent = z.infer<
  typeof objectTransformPreviewedEventSchema
>
export type SyncOperationsResponse = z.infer<
  typeof syncOperationsResponseSchema
>
export type SyncFullStateResponse = z.infer<typeof syncFullStateResponseSchema>
export type SyncResponse = z.infer<typeof syncResponseSchema>
export type SocketErrorEvent = z.infer<typeof socketErrorEventSchema>
