import { z } from "zod";
import { userSummarySchema } from "./common.js";
import { defaultJoinRoleSchema } from "./room.js";
import { roomRoleSchema } from "./identity.js";
import { whiteboardObjectSchema } from "./whiteboard.js";

export const roomSocketPrefix = "room:";

export function toRoomSocketName(roomId: string): string {
    return `${roomSocketPrefix}${roomId}`;
}

export const roomJoinRequestSchema = z.object({
    roomId: z.uuid(),
});

export const roomLeaveRequestSchema = roomJoinRequestSchema;

export const onlineUserSchema = userSummarySchema.extend({
    role: roomRoleSchema,
    status: z.literal("ONLINE"),
    selectedObjectId: z.uuid().nullable().optional(),
    connectedAt: z.string(),
});

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
});

export const presenceUpdateEventSchema = z.object({
    roomId: z.uuid(),
    onlineUsers: z.array(onlineUserSchema),
});

export const socketErrorEventSchema = z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
});

export type RoomJoinRequest = z.infer<typeof roomJoinRequestSchema>;
export type RoomLeaveRequest = z.infer<typeof roomLeaveRequestSchema>;
export type OnlineUser = z.infer<typeof onlineUserSchema>;
export type RoomStateEvent = z.infer<typeof roomStateEventSchema>;
export type PresenceUpdateEvent = z.infer<typeof presenceUpdateEventSchema>;
export type SocketErrorEvent = z.infer<typeof socketErrorEventSchema>;
