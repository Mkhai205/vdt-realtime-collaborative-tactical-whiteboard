import { z } from "zod"
import { objectTypeSchema } from "./board"
import type {
  EffectiveBoardRole,
  BoardObjectDto,
  BoardOperationDto,
} from "./board"
import type { UserSummary } from "./user"

// ─── Client → Server: Request Schemas ─────────────────────────────────────────

export const boardJoinRequestSchema = z.object({
  boardId: z.uuid(),
})
export type BoardJoinRequest = z.infer<typeof boardJoinRequestSchema>

export const boardLeaveRequestSchema = z.object({
  boardId: z.uuid(),
})
export type BoardLeaveRequest = z.infer<typeof boardLeaveRequestSchema>

export const syncRequestSchema = z.object({
  boardId: z.uuid(),
  /** Revision cuối client đã biết. Server trả về tất cả operations có revision > lastSeenRevision. */
  lastSeenRevision: z.number().int().nonnegative(),
})
export type SyncRequest = z.infer<typeof syncRequestSchema>

// --- Object mutation schemas ---

const clientOpIdSchema = z.string().min(1).max(120)

/** Payload cho object mới (không có id — server tự sinh) */
export const objectCreatePayloadSchema = z.object({
  type: objectTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  points: z.unknown().optional(),
  text: z.string().optional(),
  rotation: z.number().default(0),
  style: z.record(z.string(), z.unknown()),
  zIndex: z.number().int().default(0),
})
export type ObjectCreatePayload = z.infer<typeof objectCreatePayloadSchema>

export const objectCreateRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  object: objectCreatePayloadSchema,
})
export type ObjectCreateRequest = z.infer<typeof objectCreateRequestSchema>

/** Patch cho object update — chỉ các field cần thay đổi */
export const objectUpdatePatchSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  points: z.unknown().optional(),
  text: z.string().nullable().optional(),
  rotation: z.number().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
  zIndex: z.number().int().optional(),
})
export type ObjectUpdatePatch = z.infer<typeof objectUpdatePatchSchema>

export const objectUpdateRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  objectId: z.uuid(),
  /** Version hiện tại client đang thấy. Server reject nếu không khớp (optimistic concurrency). */
  baseVersion: z.number().int().positive(),
  patch: objectUpdatePatchSchema,
})
export type ObjectUpdateRequest = z.infer<typeof objectUpdateRequestSchema>

export const objectDeleteRequestSchema = z.object({
  clientOpId: clientOpIdSchema,
  boardId: z.uuid(),
  objectId: z.uuid(),
  /** Version hiện tại client đang thấy. Server reject nếu không khớp. */
  baseVersion: z.number().int().positive(),
})
export type ObjectDeleteRequest = z.infer<typeof objectDeleteRequestSchema>

// --- Operation history schemas ---

export const undoRequestSchema = z.object({
  boardId: z.uuid(),
})
export type UndoRequest = z.infer<typeof undoRequestSchema>

export const redoRequestSchema = z.object({
  boardId: z.uuid(),
})
export type RedoRequest = z.infer<typeof redoRequestSchema>

// --- Cursor schema ---

export const cursorMoveRequestSchema = z.object({
  boardId: z.uuid(),
  x: z.number(),
  y: z.number(),
})
export type CursorMoveRequest = z.infer<typeof cursorMoveRequestSchema>

// --- Awareness (object editing) schema ---

export const objectEditingStatus = z.enum(["STARTED", "ENDED"])
export type ObjectEditingStatus = z.infer<typeof objectEditingStatus>

export const objectEditingRequestSchema = z.object({
  boardId: z.uuid(),
  objectId: z.uuid(),
  status: objectEditingStatus,
})
export type ObjectEditingRequest = z.infer<typeof objectEditingRequestSchema>

// ─── Server → Client: Event Types ─────────────────────────────────────────────

/** User đang online trên một board */
export type OnlineUser = UserSummary & {
  effectiveRole: EffectiveBoardRole
  role: EffectiveBoardRole
  selectedObjectId?: string | null
}

/**
 * board:state — server emit ngay sau khi client join thành công.
 * Chứa đầy đủ thông tin để client render board từ đầu.
 */
export type BoardStateEvent = {
  board: {
    id: string
    name: string
    description: string | null
    currentRevision: number
    visibility: "PRIVATE" | "PUBLIC"
  }
  currentUser: OnlineUser
  objects: BoardObjectDto[]
  onlineUsers: OnlineUser[]
  /** Danh sách các object đang được chỉnh sửa bởi người dùng khác khi client join */
  editingStates: Array<{ objectId: string; user: UserSummary }>
}

/**
 * sync:response — server emit khi client gửi board:sync.
 * Chứa danh sách operations từ lastSeenRevision tới currentRevision.
 */
export type SyncResponse = {
  currentRevision: number
  operations: BoardOperationDto[]
  /** true nếu vẫn còn operations chưa trả về (client cần gửi sync tiếp) */
  hasMore: boolean
}

/** ACK trả về cho client gửi object:create */
export type ObjectCreatedAck = {
  clientOpId: string
  object: BoardObjectDto
  operation: BoardOperationDto
}

/** Broadcast đến các client khác trong room sau object:create */
export type ObjectCreatedEvent = {
  boardId: string
  object: BoardObjectDto
  operation: BoardOperationDto
}

/** ACK trả về cho client gửi object:update */
export type ObjectUpdatedAck = {
  clientOpId: string
  object: BoardObjectDto
  operation: BoardOperationDto
}

/** Broadcast đến các client khác trong room sau object:update */
export type ObjectUpdatedEvent = {
  boardId: string
  object: BoardObjectDto
  operation: BoardOperationDto
}

/** ACK trả về cho client gửi object:delete */
export type ObjectDeletedAck = {
  clientOpId: string
  objectId: string
  operation: BoardOperationDto
}

/** Broadcast đến các client khác trong room sau object:delete */
export type ObjectDeletedEvent = {
  boardId: string
  objectId: string
  operation: BoardOperationDto
}

/** Broadcast sau undo — có thể là create/update/delete tùy inverse op */
export type UndoRedoEvent = {
  boardId: string
  action: "UNDO" | "REDO"
  /**
   * Kết quả của việc áp dụng inverse:
   * - object !== null: object được restore/update
   * - objectId !== null + object === null: object bị xóa (soft delete)
   */
  object: BoardObjectDto | null
  objectId: string
  operation: BoardOperationDto
}

/** presence:update — broadcast khi có user join/leave board */
export type PresenceUpdateEvent = {
  boardId: string
  onlineUsers: OnlineUser[]
}

/** cursor:moved — broadcast khi user di chuyển cursor (không persist) */
export type CursorMovedEvent = {
  boardId: string
  user: Pick<UserSummary, "id" | "name">
  x: number
  y: number
}

/** object:editing — broadcast awareness khi user bắt đầu/kết thúc chỉnh sửa object */
export type ObjectEditingEvent = {
  boardId: string
  objectId: string
  user: UserSummary
  status: ObjectEditingStatus
  timestamp: string // ISO string
}

/** join-request:created — emit đến OWNER khi có user xin tham gia board */
export type JoinRequestCreatedEvent = {
  boardId: string
  requestId: string
  user: UserSummary
  createdAt: string // ISO string
}

/** WS error payload */
export type WsErrorPayload = {
  code: string
  message: string
  errors?: string[]
}

// ─── Event Name Constants ──────────────────────────────────────────────────────

/** Events client gửi lên server */
export const ClientEvents = {
  BOARD_JOIN: "board:join",
  BOARD_LEAVE: "board:leave",
  BOARD_SYNC: "board:sync",
  OBJECT_CREATE: "object:create",
  OBJECT_UPDATE: "object:update",
  OBJECT_DELETE: "object:delete",
  OPERATION_UNDO: "operation:undo",
  OPERATION_REDO: "operation:redo",
  CURSOR_MOVE: "cursor:move",
  OBJECT_EDITING: "object:editing",
} as const
export type ClientEvent = (typeof ClientEvents)[keyof typeof ClientEvents]

/** Events server emit xuống client */
export const ServerEvents = {
  BOARD_STATE: "board:state",
  SYNC_RESPONSE: "sync:response",
  OBJECT_CREATED: "object:created",
  OBJECT_UPDATED: "object:updated",
  OBJECT_DELETED: "object:deleted",
  UNDO_REDO: "operation:undoredo",
  PRESENCE_UPDATE: "presence:update",
  CURSOR_MOVED: "cursor:moved",
  OBJECT_EDITING: "object:editing",
  JOIN_REQUEST_CREATED: "join-request:created",
  ERROR: "error",
} as const
export type ServerEvent = (typeof ServerEvents)[keyof typeof ServerEvents]

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Tạo tên Socket.IO room cho một board */
export const toBoardSocketName = (boardId: string): string => `board:${boardId}`
