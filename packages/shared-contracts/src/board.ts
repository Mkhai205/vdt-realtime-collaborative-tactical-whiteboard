import { z } from "zod";
import { boardRoleSchema } from "./identity.js";
import { userSummarySchema } from "./common.js";

export const defaultJoinRoleSchema = z.enum(["EDITOR", "VIEWER"]);
export const memberRoleInputSchema = z.enum(["EDITOR", "VIEWER"]);

export const boardIdParamsSchema = z.object({
    boardId: z.uuid(),
});

export const boardMemberIdParamsSchema = boardIdParamsSchema.extend({
    memberId: z.uuid(),
});

export const boardSummarySchema = z.object({
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

export const boardMemberSummarySchema = z.object({
    id: z.uuid(),
    boardId: z.uuid(),
    user: userSummarySchema,
    role: boardRoleSchema,
    joinedAt: z.string(),
});

export const createBoardRequestSchema = z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    isPublic: z.boolean().default(true),
    defaultJoinRole: defaultJoinRoleSchema.default("EDITOR"),
});

export const createBoardResponseSchema = z.object({
    board: boardSummarySchema,
    currentUser: userSummarySchema.extend({
        role: z.literal("OWNER"),
    }),
});

export const listBoardsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().default(50),
});

export const listBoardsResponseSchema = z.object({
    boards: z.array(boardSummarySchema),
});

export const getBoardResponseSchema = z.object({
    board: boardSummarySchema,
    currentUser: userSummarySchema.extend({
        role: boardRoleSchema,
    }),
});

export const joinBoardResponseSchema = z.object({
    board: boardSummarySchema,
    currentUser: userSummarySchema.extend({
        role: boardRoleSchema,
    }),
});

export const getBoardMembersResponseSchema = z.object({
    boardId: z.uuid(),
    members: z.array(boardMemberSummarySchema),
});

export const addBoardMemberRequestSchema = z.object({
    userId: z.uuid(),
    role: memberRoleInputSchema,
});

export const updateBoardMemberRoleRequestSchema = z.object({
    role: memberRoleInputSchema,
});

export const boardMemberMutationResponseSchema = z.object({
    member: boardMemberSummarySchema,
});

export const updateBoardRequestSchema = z
    .object({
        name: z.string().trim().min(1).max(160).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        isPublic: z.boolean().optional(),
        defaultJoinRole: defaultJoinRoleSchema.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one board field is required.",
    });

export const updateBoardResponseSchema = z.object({
    board: boardSummarySchema,
});

export type DefaultJoinRole = z.infer<typeof defaultJoinRoleSchema>;
export type MemberRoleInput = z.infer<typeof memberRoleInputSchema>;
export type BoardIdParams = z.infer<typeof boardIdParamsSchema>;
export type BoardMemberIdParams = z.infer<typeof boardMemberIdParamsSchema>;
export type BoardSummary = z.infer<typeof boardSummarySchema>;
export type BoardMemberSummary = z.infer<typeof boardMemberSummarySchema>;
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;
export type CreateBoardResponse = z.infer<typeof createBoardResponseSchema>;
export type ListBoardsQuery = z.infer<typeof listBoardsQuerySchema>;
export type ListBoardsResponse = z.infer<typeof listBoardsResponseSchema>;
export type GetBoardResponse = z.infer<typeof getBoardResponseSchema>;
export type JoinBoardResponse = z.infer<typeof joinBoardResponseSchema>;
export type GetBoardMembersResponse = z.infer<
    typeof getBoardMembersResponseSchema
>;
export type AddBoardMemberRequest = z.infer<typeof addBoardMemberRequestSchema>;
export type UpdateBoardMemberRoleRequest = z.infer<
    typeof updateBoardMemberRoleRequestSchema
>;
export type BoardMemberMutationResponse = z.infer<
    typeof boardMemberMutationResponseSchema
>;
export type UpdateBoardRequest = z.infer<typeof updateBoardRequestSchema>;
export type UpdateBoardResponse = z.infer<typeof updateBoardResponseSchema>;
