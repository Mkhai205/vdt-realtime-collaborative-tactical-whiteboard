import type {
  BoardMemberSummary,
  BoardRole,
  BoardSummary,
  DefaultJoinRole,
  UserSummary,
} from "@rctw/shared-contracts"

type BoardRecord = {
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

type BoardMemberRecord = {
  id: string
  boardId: string
  user: UserSummary
  role: string
  joinedAt: Date | string
}

export function toBoardSummary(board: BoardRecord): BoardSummary {
  return {
    id: board.id,
    name: board.name,
    description: board.description ?? null,
    currentRevision: Number(board.currentRevision),
    isPublic: board.isPublic,
    defaultJoinRole: board.defaultJoinRole as DefaultJoinRole,
    createdBy: board.createdBy,
    createdAt: toIsoString(board.createdAt),
    updatedAt: toIsoString(board.updatedAt),
  }
}

export function toBoardMemberSummary(
  member: BoardMemberRecord,
): BoardMemberSummary {
  return {
    id: member.id,
    boardId: member.boardId,
    user: member.user,
    role: member.role as BoardRole,
    joinedAt: toIsoString(member.joinedAt),
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
