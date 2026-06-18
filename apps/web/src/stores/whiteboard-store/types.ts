import type {
  CursorUpdateRequest,
  CursorUpdatedEvent,
  EditingEndRequest,
  EditingStartRequest,
  ObjectEditingEvent,
  ObjectCreateSocketRequest,
  ObjectDeleteSocketRequest,
  ObjectMutablePatch,
  ObjectTransformPreviewPatch,
  ObjectTransformPreviewRequest,
  ObjectTransformPreviewedEvent,
  ObjectType,
  ObjectUpdateSocketRequest,
  OnlineUser,
  OperationAppliedEvent,
  OperationRejectedEvent,
  RedoRequest,
  BoardRole as RoomRole,
  BoardStateEvent as RoomStateEvent,
  SelectionUpdateRequest,
  ShapeStyle,
  Tool,
  UndoRequest,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import type { CanvasPoint, StageSize, Viewport } from "@/lib/canvas-utils"
import {
  PendingWhiteboardHistoryEntry,
  WhiteboardHistoryEntry,
} from "@/lib/whiteboard-history"

export type WhiteboardCurrentUser = UserSummary & {
  role: RoomRole
}

export type WhiteboardRoomState = RoomStateEvent["board"]

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"

export type WhiteboardToastVariant = "info" | "error"

export type WhiteboardToast = {
  id: string
  message: string
  variant: WhiteboardToastVariant
  createdAt: number
}

export type LoadedRoomStateInput = {
  room: WhiteboardRoomState
  currentUser: WhiteboardCurrentUser
  currentRevision: number
  objects: WhiteboardObject[]
  onlineUsers?: OnlineUser[]
}

export type RemoteTransformPreview = {
  roomId: string
  objectId: string
  user: UserSummary
  preview: ObjectTransformPreviewPatch
  timestamp: string
  receivedAt: number
}

export type RemoteCursor = CursorUpdatedEvent & {
  receivedAt: number
}

export type RemoteEditingState = ObjectEditingEvent & {
  receivedAt: number
}

export type LocalObjectInput = {
  type: ObjectType
  x: number
  y: number
  width?: number
  height?: number
  points?: number[]
  text?: string
  rotation?: number
  style: ShapeStyle
}

export type WhiteboardApplyOperationOptions = {
  removeObjectId?: string
  historyCandidate?: PendingWhiteboardHistoryEntry
}

export type WhiteboardOperationSenderOptions = {
  tempObjectId?: string
  historyCandidate?: PendingWhiteboardHistoryEntry
}

export type WhiteboardOperationSender = {
  createObject: (
    request: ObjectCreateSocketRequest,
    options?: WhiteboardOperationSenderOptions,
  ) => Promise<OperationAppliedEvent>
  updateObject: (
    request: ObjectUpdateSocketRequest,
    options?: WhiteboardOperationSenderOptions,
  ) => Promise<OperationAppliedEvent>
  deleteObject: (
    request: ObjectDeleteSocketRequest,
    options?: WhiteboardOperationSenderOptions,
  ) => Promise<OperationAppliedEvent>
  undoOperation: (request: UndoRequest) => Promise<OperationAppliedEvent>
  redoOperation: (request: RedoRequest) => Promise<OperationAppliedEvent>
}

export type WhiteboardTransformPreviewSender = {
  sendPreview: (request: ObjectTransformPreviewRequest) => void
}

export type WhiteboardCursorSender = {
  sendCursorUpdate: (request: CursorUpdateRequest) => void
}

export type WhiteboardEditingSender = {
  startEditing: (request: EditingStartRequest) => void
  endEditing: (request: EditingEndRequest) => void
}

export type WhiteboardSelectionSender = {
  sendSelectionUpdate: (request: SelectionUpdateRequest) => void
}

export type WhiteboardState = {
  roomId: string | null
  room: WhiteboardRoomState | null
  currentUser: WhiteboardCurrentUser | null
  currentRevision: number
  lastSeenRevision: number
  connectionStatus: ConnectionStatus
  socketError: string | null
  onlineUsers: OnlineUser[]
  mutationError: string | null
  toasts: WhiteboardToast[]
  objects: Record<string, WhiteboardObject>
  remoteCursors: Record<string, RemoteCursor>
  remoteEditors: Record<string, Record<string, RemoteEditingState>>
  remoteTransformPreviews: Record<string, RemoteTransformPreview>
  appliedClientOpIds: Record<string, true>
  undoStack: WhiteboardHistoryEntry[]
  redoStack: WhiteboardHistoryEntry[]
  selectedObjectId: string | null
  currentTool: Tool
  toolRevision: number
  objectOperationSender: WhiteboardOperationSender | null
  transformPreviewSender: WhiteboardTransformPreviewSender | null
  cursorSender: WhiteboardCursorSender | null
  editingSender: WhiteboardEditingSender | null
  selectionSender: WhiteboardSelectionSender | null
  viewport: Viewport
  stageSize: StageSize
  setRoomId: (roomId: string) => void
  selectObject: (objectId: string | null) => void
  setTool: (tool: Tool) => void
  setLoadedRoomState: (input: LoadedRoomStateInput) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setSocketError: (message: string | null) => void
  setOnlineUsers: (onlineUsers: OnlineUser[]) => void
  setMutationError: (message: string | null) => void
  dismissToast: (toastId: string) => void
  setObjectOperationSender: (sender: WhiteboardOperationSender | null) => void
  setTransformPreviewSender: (
    sender: WhiteboardTransformPreviewSender | null,
  ) => void
  setCursorSender: (sender: WhiteboardCursorSender | null) => void
  setEditingSender: (sender: WhiteboardEditingSender | null) => void
  setSelectionSender: (sender: WhiteboardSelectionSender | null) => void
  setObjects: (objects: WhiteboardObject[]) => void
  setObjectsWithRevision: (
    objects: WhiteboardObject[],
    currentRevision: number,
  ) => void
  markRevisionSynced: (revision: number) => void
  upsertObject: (object: WhiteboardObject) => void
  applyOperation: (
    operation: OperationAppliedEvent,
    options?: WhiteboardApplyOperationOptions,
  ) => void
  applyOperationRejection: (rejection: OperationRejectedEvent) => void
  pushUndoEntry: (entry: WhiteboardHistoryEntry) => void
  moveLatestUndoEntryToRedo: () => WhiteboardHistoryEntry | null
  moveLatestRedoEntryToUndo: () => WhiteboardHistoryEntry | null
  clearHistoryStacks: () => void
  undoLastOperation: () => void
  redoLastOperation: () => void
  applyRemoteTransformPreview: (event: ObjectTransformPreviewedEvent) => void
  applyRemoteCursor: (event: CursorUpdatedEvent) => void
  applyRemoteEditing: (event: ObjectEditingEvent) => void
  sendCursorUpdate: (point: CanvasPoint) => void
  sendEditingStart: (objectId: string) => void
  sendEditingEnd: (objectId: string) => void
  sendSelectionUpdate: (selectedObjectId: string | null) => void
  clearRemoteTransformPreview: (objectId: string) => void
  sendTransformPreview: (
    objectId: string,
    preview: ObjectTransformPreviewPatch,
  ) => void
  updateObjectPatch: (objectId: string, patch: ObjectMutablePatch) => void
  removeObject: (objectId: string) => void
  deleteSelectedObject: () => void
  createLocalObject: (input: LocalObjectInput) => WhiteboardObject | null
  seedDemoObjects: (roomId: string) => void
  setStageSize: (stageSize: StageSize) => void
  setViewport: (viewport: Viewport) => void
  panViewportBy: (delta: CanvasPoint) => void
  zoomViewportBy: (factor: number, anchor?: CanvasPoint) => void
  resetViewport: () => void
}
