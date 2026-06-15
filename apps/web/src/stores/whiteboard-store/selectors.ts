import type { WhiteboardState } from "./types"

// Grouped Actions for Socket Connection Manager
export const selectSocketActions = (s: WhiteboardState) => ({
  setRoomId: s.setRoomId,
  setLoadedRoomState: s.setLoadedRoomState,
  setObjectsWithRevision: s.setObjectsWithRevision,
  setConnectionStatus: s.setConnectionStatus,
  setSocketError: s.setSocketError,
  setOnlineUsers: s.setOnlineUsers,
  setObjectOperationSender: s.setObjectOperationSender,
  setTransformPreviewSender: s.setTransformPreviewSender,
  setCursorSender: s.setCursorSender,
  setEditingSender: s.setEditingSender,
  setSelectionSender: s.setSelectionSender,
  applyOperation: s.applyOperation,
  markRevisionSynced: s.markRevisionSynced,
  applyOperationRejection: s.applyOperationRejection,
  applyRemoteTransformPreview: s.applyRemoteTransformPreview,
  applyRemoteCursor: s.applyRemoteCursor,
  applyRemoteEditing: s.applyRemoteEditing,
})

// Page State (whiteboard-page.tsx)
export const selectPageState = (s: WhiteboardState) => ({
  room: s.room,
  currentUser: s.currentUser,
  currentRevision: s.currentRevision,
  connectionStatus: s.connectionStatus,
  socketError: s.socketError,
  onlineUsers: s.onlineUsers,
  mutationError: s.mutationError,
  toasts: s.toasts,
  viewport: s.viewport,
  stageSize: s.stageSize,
  currentTool: s.currentTool,
})

// Page Actions (whiteboard-page.tsx)
export const selectPageActions = (s: WhiteboardState) => ({
  deleteSelectedObject: s.deleteSelectedObject,
  undoLastOperation: s.undoLastOperation,
  redoLastOperation: s.redoLastOperation,
  dismissToast: s.dismissToast,
  zoomViewportBy: s.zoomViewportBy,
  setTool: s.setTool,
})

// Toolbar State
export const selectToolbarState = (s: WhiteboardState) => ({
  currentTool: s.currentTool,
  selectedObjectId: s.selectedObjectId,
  undoCount: s.undoStack.length,
  redoCount: s.redoStack.length,
  role: s.currentUser?.role,
})

// Stage State (whiteboard-stage.tsx)
export const selectStageState = (s: WhiteboardState) => ({
  currentTool: s.currentTool,
  toolRevision: s.toolRevision,
  selectedObjectId: s.selectedObjectId,
  selectedObject: s.selectedObjectId ? s.objects[s.selectedObjectId] : null,
  currentUserRole: s.currentUser?.role,
  viewport: s.viewport,
  stageSize: s.stageSize,
})

// Stage Actions (whiteboard-stage.tsx)
export const selectStageActions = (s: WhiteboardState) => ({
  createLocalObject: s.createLocalObject,
  selectObject: s.selectObject,
  setStageSize: s.setStageSize,
  panViewportBy: s.panViewportBy,
  zoomViewportBy: s.zoomViewportBy,
  updateObjectPatch: s.updateObjectPatch,
  sendTransformPreview: s.sendTransformPreview,
  sendCursorUpdate: s.sendCursorUpdate,
  sendEditingStart: s.sendEditingStart,
  sendEditingEnd: s.sendEditingEnd,
})
