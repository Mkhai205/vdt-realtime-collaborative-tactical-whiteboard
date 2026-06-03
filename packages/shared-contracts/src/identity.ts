import { z } from "zod";

export const identityTypeSchema = z.enum(["GUEST", "GOOGLE"]);
export const roomRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

export type IdentityType = z.infer<typeof identityTypeSchema>;
export type RoomRole = z.infer<typeof roomRoleSchema>;
