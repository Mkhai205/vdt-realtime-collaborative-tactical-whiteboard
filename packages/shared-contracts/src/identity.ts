import { z } from "zod";

export const identityTypeSchema = z.enum(["GUEST", "GOOGLE"]);
export const roomRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

export const guestIdentityStorageKey = "rctw.guestIdentity.v1";

export const guestRestHeaderNames = {
  id: "x-guest-id",
  name: "x-guest-name",
  avatarColor: "x-guest-avatar-color",
} as const;

export const guestNameSchema = z.string().trim().min(1).max(120);
export const guestAvatarColorSchema = z.string().trim().min(1).max(20);

export const guestIdentitySchema = z.object({
  id: z.uuid(),
  name: guestNameSchema,
  avatarColor: guestAvatarColorSchema,
});

export const guestRestHeadersSchema = z.object({
  [guestRestHeaderNames.id]: z.uuid(),
  [guestRestHeaderNames.name]: guestNameSchema,
  [guestRestHeaderNames.avatarColor]: guestAvatarColorSchema,
});

export const socketAuthPayloadSchema = z.object({
  token: z.string().trim().min(1).optional(),
  guestId: z.uuid().optional(),
  guestName: guestNameSchema.optional(),
  guestAvatarColor: guestAvatarColorSchema.optional(),
});

export function buildGuestRestHeaders(
  identity: GuestIdentity,
): GuestRestHeaders {
  return {
    [guestRestHeaderNames.id]: identity.id,
    [guestRestHeaderNames.name]: identity.name,
    [guestRestHeaderNames.avatarColor]: identity.avatarColor,
  };
}

export function buildGuestSocketAuth(
  identity: GuestIdentity,
): SocketAuthPayload {
  return {
    guestId: identity.id,
    guestName: identity.name,
    guestAvatarColor: identity.avatarColor,
  };
}

export type IdentityType = z.infer<typeof identityTypeSchema>;
export type RoomRole = z.infer<typeof roomRoleSchema>;
export type GuestIdentity = z.infer<typeof guestIdentitySchema>;
export type GuestRestHeaders = z.infer<typeof guestRestHeadersSchema>;
export type SocketAuthPayload = z.infer<typeof socketAuthPayloadSchema>;
