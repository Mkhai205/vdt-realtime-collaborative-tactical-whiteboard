import type { StateCreator } from "zustand"
import type { WhiteboardState } from "./types"
import { clearAllRemotePreviewTimeouts } from "./collaboration-slice"

export type OperationsSlice = {
  setRoomId: (roomId: string) => void
  setMutationError: (message: string | null) => void
}

export const createOperationsSlice: StateCreator<
  WhiteboardState,
  [],
  [],
  OperationsSlice
> = (set, get) => ({
  setRoomId: (roomId) => {
    if (get().roomId !== roomId) {
      clearAllRemotePreviewTimeouts()
    }

    set({
      roomId,
      room: null,
      currentUser: null,
      connectionStatus: "idle",
      socketError: null,
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
    })
  },
  setMutationError: (message) =>
    set({
      mutationError: message,
    }),
})
