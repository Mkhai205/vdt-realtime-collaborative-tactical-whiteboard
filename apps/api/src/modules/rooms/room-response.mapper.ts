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
    defaultJoinRole: room.defaultJoinRole as DefaultJoinRole,
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
    role: member.role as RoomRole,
    joinedAt: toIsoString(member.joinedAt),
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
