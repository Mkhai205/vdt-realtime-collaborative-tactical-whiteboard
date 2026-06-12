import type { StageSize } from "@/lib/canvas-utils"
import { initialViewport } from "@/lib/canvas-utils"
import type { WhiteboardState } from "./types"

export const emptyStageSize: StageSize = {
  width: 0,
  height: 0,
}

export type WhiteboardInitialState = Pick<
  WhiteboardState,
  | "roomId"
  | "room"
  | "currentUser"
  | "currentRevision"
  | "lastSeenRevision"
  | "connectionStatus"
  | "socketError"
  | "onlineUsers"
  | "mutationError"
  | "toasts"
  | "objects"
  | "remoteCursors"
  | "remoteEditors"
  | "remoteTransformPreviews"
  | "appliedClientOpIds"
  | "undoStack"
  | "redoStack"
  | "selectedObjectId"
  | "currentTool"
  | "toolRevision"
  | "objectOperationSender"
  | "transformPreviewSender"
  | "cursorSender"
  | "editingSender"
  | "selectionSender"
  | "viewport"
  | "stageSize"
>

export const initialWhiteboardState: WhiteboardInitialState = {
  roomId: null,
  room: null,
  currentUser: null,
  currentRevision: 0,
  lastSeenRevision: 0,
  connectionStatus: "idle",
  socketError: null,
  onlineUsers: [],
  mutationError: null,
  toasts: [],
  objects: {},
  remoteCursors: {},
  remoteEditors: {},
  remoteTransformPreviews: {},
  appliedClientOpIds: {},
  undoStack: [],
  redoStack: [],
  selectedObjectId: null,
  currentTool: "SELECT",
  toolRevision: 0,
  objectOperationSender: null,
  transformPreviewSender: null,
  cursorSender: null,
  editingSender: null,
  selectionSender: null,
  viewport: initialViewport,
  stageSize: emptyStageSize,
}
