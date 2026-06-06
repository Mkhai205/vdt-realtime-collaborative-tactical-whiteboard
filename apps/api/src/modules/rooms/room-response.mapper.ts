import type {
  DefaultJoinRole,
  RoomMemberSummary,
  RoomRole,
  RoomSummary,
  UserSummary,
} from "@rctw/shared-contracts"

type RoomRecord = {
  id: string
  name: string
  description?: string | null
  currentRevision: bigint | number
  isPublic: boolean
  defaultJoinRole: string
  createdBy: UserSummary
  createdAt: Date | string
  updatedAt: Date | string
}

type RoomMemberRecord = {
  id: string
  roomId: string
  user: UserSummary
  role: string
  joinedAt: Date | string
}

export function toRoomSummary(room: RoomRecord): RoomSummary {
  return {
    id: room.id,
    name: room.name,
    description: room.description ?? null,
    currentRevision: Number(room.currentRevision),
    isPublic: room.isPublic,
    defaultJoinRole: toDefaultJoinRole(room.defaultJoinRole),
    createdBy: room.createdBy,
    createdAt: toIsoString(room.createdAt),
    updatedAt: toIsoString(room.updatedAt),
  }
}

export function toRoomMemberSummary(
  member: RoomMemberRecord,
): RoomMemberSummary {
  return {
    id: member.id,
    roomId: member.roomId,
    user: member.user,
    role: toRoomRole(member.role),
    joinedAt: toIsoString(member.joinedAt),
  }
}

export function toDefaultJoinRole(role: string): DefaultJoinRole {
  return role === "VIEWER" ? "VIEWER" : "EDITOR"
}

export function toRoomRole(role: string): RoomRole {
  if (role === "OWNER" || role === "VIEWER") {
    return role
  }

  return "EDITOR"
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
