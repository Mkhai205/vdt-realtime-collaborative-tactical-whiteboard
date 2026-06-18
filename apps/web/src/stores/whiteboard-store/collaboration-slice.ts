import type { StateCreator } from "zustand"
import type {
  CursorUpdatedEvent,
  ObjectEditingEvent,
  ObjectTransformPreviewedEvent,
  OnlineUser,
} from "@rctw/shared-contracts"
import type { CanvasPoint } from "@/lib/canvas-utils"
import type {
  WhiteboardState,
  RemoteCursor,
  RemoteEditingState,
  RemoteTransformPreview,
} from "./types"
import { canEditRoom } from "@/lib/room-utils"

const remoteTransformPreviewStaleMs = 1500
const remoteTransformPreviewTimeouts = new Map<
  string,
  ReturnType<typeof setTimeout>
>()

export function clearRemotePreviewTimeout(objectId: string | null | undefined) {
  if (!objectId) {
    return
  }

  const timeout = remoteTransformPreviewTimeouts.get(objectId)

  if (!timeout) {
    return
  }

  clearTimeout(timeout)
  remoteTransformPreviewTimeouts.delete(objectId)
}

export function clearAllRemotePreviewTimeouts() {
  for (const timeout of remoteTransformPreviewTimeouts.values()) {
    clearTimeout(timeout)
  }

  remoteTransformPreviewTimeouts.clear()
}

function scheduleRemotePreviewTimeout(
  objectId: string,
  clearRemoteTransformPreview: (targetObjectId: string) => void,
) {
  clearRemotePreviewTimeout(objectId)

  const timeout = setTimeout(() => {
    remoteTransformPreviewTimeouts.delete(objectId)
    clearRemoteTransformPreview(objectId)
  }, remoteTransformPreviewStaleMs)

  remoteTransformPreviewTimeouts.set(objectId, timeout)
}

function pruneRemoteCursors(
  cursors: Record<string, RemoteCursor>,
  onlineUsers: OnlineUser[],
  currentUserId: string | null | undefined,
): Record<string, RemoteCursor> {
  const onlineUserIds = new Set(onlineUsers.map((user) => user.id))
  let nextCursors = cursors

  for (const userId of Object.keys(cursors)) {
    if (userId !== currentUserId && onlineUserIds.has(userId)) {
      continue
    }

    if (nextCursors === cursors) {
      nextCursors = { ...cursors }
    }

    delete nextCursors[userId]
  }

  return nextCursors
}

function pruneRemoteEditors(
  editors: Record<string, Record<string, RemoteEditingState>>,
  onlineUsers: OnlineUser[],
  currentUserId: string | null | undefined,
): Record<string, Record<string, RemoteEditingState>> {
  const onlineUserIds = new Set(onlineUsers.map((user) => user.id))
  let nextEditors = editors

  for (const [objectId, editorsByUserId] of Object.entries(editors)) {
    let nextEditorsByUserId = editorsByUserId

    for (const userId of Object.keys(editorsByUserId)) {
      if (userId !== currentUserId && onlineUserIds.has(userId)) {
        continue
      }

      if (nextEditors === editors) {
        nextEditors = { ...editors }
      }

      if (nextEditorsByUserId === editorsByUserId) {
        nextEditorsByUserId = { ...editorsByUserId }
        nextEditors[objectId] = nextEditorsByUserId
      }

      delete nextEditorsByUserId[userId]
    }

    if (
      nextEditorsByUserId !== editorsByUserId &&
      Object.keys(nextEditorsByUserId).length === 0
    ) {
      delete nextEditors[objectId]
    }
  }

  return nextEditors
}

export type CollaborationSlice = {
  setObjectOperationSender: (
    sender: WhiteboardState["objectOperationSender"],
  ) => void
  setTransformPreviewSender: (
    sender: WhiteboardState["transformPreviewSender"],
  ) => void
  setCursorSender: (sender: WhiteboardState["cursorSender"]) => void
  setEditingSender: (sender: WhiteboardState["editingSender"]) => void
  setSelectionSender: (sender: WhiteboardState["selectionSender"]) => void
  setOnlineUsers: (onlineUsers: OnlineUser[]) => void
  applyRemoteTransformPreview: (event: ObjectTransformPreviewedEvent) => void
  applyRemoteCursor: (event: CursorUpdatedEvent) => void
  applyRemoteEditing: (event: ObjectEditingEvent) => void
  clearRemoteTransformPreview: (objectId: string) => void
  sendCursorUpdate: (point: CanvasPoint) => void
  sendEditingStart: (objectId: string) => void
  sendEditingEnd: (objectId: string) => void
  sendSelectionUpdate: (selectedObjectId: string | null) => void
  sendTransformPreview: (
    objectId: string,
    preview: RemoteTransformPreview["preview"],
  ) => void
}

export const createCollaborationSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  CollaborationSlice
> = (set, get) => ({
  setObjectOperationSender: (sender) =>
    set({
      objectOperationSender: sender,
    }),
  setTransformPreviewSender: (sender) =>
    set({
      transformPreviewSender: sender,
    }),
  setCursorSender: (sender) =>
    set({
      cursorSender: sender,
    }),
  setEditingSender: (sender) =>
    set({
      editingSender: sender,
    }),
  setSelectionSender: (sender) =>
    set({
      selectionSender: sender,
    }),
  setOnlineUsers: (onlineUsers) =>
    set((state) => ({
      onlineUsers,
      remoteCursors: pruneRemoteCursors(
        state.remoteCursors,
        onlineUsers,
        state.currentUser?.id,
      ),
      remoteEditors: pruneRemoteEditors(
        state.remoteEditors,
        onlineUsers,
        state.currentUser?.id,
      ),
    })),
  applyRemoteTransformPreview: (event) => {
    const state = get()

    if (state.roomId !== event.boardId) {
      return
    }

    const object = state.objects[event.objectId]

    if (!object || object.deletedAt) {
      return
    }

    set((currentState) => {
      if (currentState.roomId !== event.boardId) {
        return currentState
      }

      const currentObject = currentState.objects[event.objectId]

      if (!currentObject || currentObject.deletedAt) {
        return currentState
      }

      return {
        remoteTransformPreviews: {
          ...currentState.remoteTransformPreviews,
          [event.objectId]: {
            ...event,
            roomId: event.boardId,
            receivedAt: Date.now(),
          },
        },
      }
    })

    scheduleRemotePreviewTimeout(
      event.objectId,
      get().clearRemoteTransformPreview,
    )
  },
  applyRemoteCursor: (event) =>
    set((state) => {
      if (
        state.roomId !== event.boardId ||
        state.currentUser?.id === event.user.id
      ) {
        return state
      }

      return {
        remoteCursors: {
          ...state.remoteCursors,
          [event.user.id]: {
            ...event,
            roomId: event.boardId,
            receivedAt: Date.now(),
          },
        },
      }
    }),
  applyRemoteEditing: (event) =>
    set((state) => {
      if (
        state.roomId !== event.boardId ||
        state.currentUser?.id === event.user.id
      ) {
        return state
      }

      const object = state.objects[event.objectId]
      const currentEditors = state.remoteEditors[event.objectId]

      if (event.status === "ENDED") {
        if (!currentEditors?.[event.user.id]) {
          return state
        }

        const nextObjectEditors = { ...currentEditors }
        delete nextObjectEditors[event.user.id]

        const nextRemoteEditors = { ...state.remoteEditors }

        if (Object.keys(nextObjectEditors).length === 0) {
          delete nextRemoteEditors[event.objectId]
        } else {
          nextRemoteEditors[event.objectId] = nextObjectEditors
        }

        return {
          remoteEditors: nextRemoteEditors,
        }
      }

      if (!object || object.deletedAt) {
        return state
      }

      return {
        remoteEditors: {
          ...state.remoteEditors,
          [event.objectId]: {
            ...currentEditors,
            [event.user.id]: {
              ...event,
              roomId: event.boardId,
              receivedAt: Date.now(),
            },
          },
        },
      }
    }),
  clearRemoteTransformPreview: (objectId) => {
    clearRemotePreviewTimeout(objectId)

    set((state) => {
      if (!(objectId in state.remoteTransformPreviews)) {
        return state
      }

      const nextRemoteTransformPreviews = {
        ...state.remoteTransformPreviews,
      }
      delete nextRemoteTransformPreviews[objectId]

      return {
        remoteTransformPreviews: nextRemoteTransformPreviews,
      }
    })
  },
  sendCursorUpdate: (point) => {
    const state = get()

    if (!state.roomId || !state.cursorSender) {
      return
    }

    state.cursorSender.sendCursorUpdate({
      boardId: state.roomId,
      x: point.x,
      y: point.y,
      selectedObjectId: state.selectedObjectId,
      currentTool: state.currentTool,
    })
  },
  sendEditingStart: (objectId) => {
    const state = get()
    const object = state.objects[objectId]

    if (
      !state.roomId ||
      !state.editingSender ||
      !canEditRoom(state.currentUser?.role) ||
      !object ||
      object.deletedAt
    ) {
      return
    }

    state.editingSender.startEditing({
      boardId: state.roomId,
      objectId,
    })
  },
  sendEditingEnd: (objectId) => {
    const state = get()

    if (
      !state.roomId ||
      !state.editingSender ||
      !canEditRoom(state.currentUser?.role)
    ) {
      return
    }

    state.editingSender.endEditing({
      boardId: state.roomId,
      objectId,
    })
  },
  sendSelectionUpdate: (selectedObjectId) => {
    const state = get()

    if (!state.roomId || !state.selectionSender) {
      return
    }

    state.selectionSender.sendSelectionUpdate({
      boardId: state.roomId,
      selectedObjectId,
    })
  },
  sendTransformPreview: (objectId, preview) => {
    const state = get()
    const object = state.objects[objectId]

    if (
      !state.roomId ||
      !state.transformPreviewSender ||
      !canEditRoom(state.currentUser?.role) ||
      !object ||
      object.deletedAt
    ) {
      return
    }

    state.transformPreviewSender.sendPreview({
      boardId: state.roomId,
      objectId,
      preview,
    })
  },
})
