import { z } from "zod";
import { roomRoleSchema } from "./identity.js";
import { userSummarySchema } from "./common.js";

export const defaultJoinRoleSchema = z.enum(["EDITOR", "VIEWER"]);

export const roomIdParamsSchema = z.object({
    roomId: z.uuid(),
});

export const roomSummarySchema = z.object({
    id: z.uuid(),
    name: z.string().min(1).max(160),
    description: z.string().nullable().optional(),
    currentRevision: z.number().int().nonnegative(),
    isPublic: z.boolean(),
    defaultJoinRole: defaultJoinRoleSchema,
    createdBy: userSummarySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const roomMemberSummarySchema = z.object({
    id: z.uuid(),
    roomId: z.uuid(),
    user: userSummarySchema,
    role: roomRoleSchema,
    joinedAt: z.string(),
});

export const createRoomRequestSchema = z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    isPublic: z.boolean().default(true),
    defaultJoinRole: defaultJoinRoleSchema.default("EDITOR"),
});

export const createRoomResponseSchema = z.object({
    room: roomSummarySchema,
    currentUser: userSummarySchema.extend({
        role: z.literal("OWNER"),
    }),
});

export const listRoomsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().default(50),
});

export const listRoomsResponseSchema = z.object({
    rooms: z.array(roomSummarySchema),
});

export const getRoomResponseSchema = z.object({
    room: roomSummarySchema,
    currentUser: userSummarySchema.extend({
        role: roomRoleSchema,
    }),
});

export const joinRoomResponseSchema = z.object({
    room: roomSummarySchema,
    currentUser: userSummarySchema.extend({
        role: roomRoleSchema,
    }),
});

export const getRoomMembersResponseSchema = z.object({
    roomId: z.uuid(),
    members: z.array(roomMemberSummarySchema),
});

export const updateRoomRequestSchema = z
    .object({
        name: z.string().trim().min(1).max(160).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        isPublic: z.boolean().optional(),
        defaultJoinRole: defaultJoinRoleSchema.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one room field is required.",
    });

export const updateRoomResponseSchema = z.object({
    room: roomSummarySchema,
});

export type DefaultJoinRole = z.infer<typeof defaultJoinRoleSchema>;
export type RoomIdParams = z.infer<typeof roomIdParamsSchema>;
export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type RoomMemberSummary = z.infer<typeof roomMemberSummarySchema>;
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;
export type ListRoomsQuery = z.infer<typeof listRoomsQuerySchema>;
export type ListRoomsResponse = z.infer<typeof listRoomsResponseSchema>;
export type GetRoomResponse = z.infer<typeof getRoomResponseSchema>;
export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;
export type GetRoomMembersResponse = z.infer<
    typeof getRoomMembersResponseSchema
>;
export type UpdateRoomRequest = z.infer<typeof updateRoomRequestSchema>;
export type UpdateRoomResponse = z.infer<typeof updateRoomResponseSchema>;
