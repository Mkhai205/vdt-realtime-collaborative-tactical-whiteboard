import type { StateCreator } from "zustand"
import type { WhiteboardState } from "./types"
import { canEditRoom } from "@/lib/room-utils"
import {
  pushUndoStackEntry,
  moveLatestUndoToRedo,
  moveLatestRedoToUndo,
  clearWhiteboardHistoryStacks,
  createUndoOperation,
  createRedoOperation,
  createRedoStackEntryAfterUndo,
  createUndoStackEntryAfterRedo,
  type WhiteboardHistoryEntry,
} from "@/lib/whiteboard-history"
import { enqueueMutation, handleUndoRedoOperationFailure } from "./helpers"

export type HistorySlice = {
  pushUndoEntry: (entry: WhiteboardHistoryEntry) => void
  moveLatestUndoEntryToRedo: () => WhiteboardHistoryEntry | null
  moveLatestRedoEntryToUndo: () => WhiteboardHistoryEntry | null
  clearHistoryStacks: () => void
  undoLastOperation: () => void
  redoLastOperation: () => void
}

export const createHistorySlice: StateCreator<
  WhiteboardState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  pushUndoEntry: (entry) =>
    set((state) => pushUndoStackEntry(state.undoStack, entry)),
  moveLatestUndoEntryToRedo: () => {
    let movedEntry: WhiteboardHistoryEntry | null = null

    set((state) => {
      const result = moveLatestUndoToRedo(state.undoStack, state.redoStack)
      movedEntry = result.movedEntry

      return {
        undoStack: result.undoStack,
        redoStack: result.redoStack,
      }
    })

    return movedEntry
  },
  moveLatestRedoEntryToUndo: () => {
    let movedEntry: WhiteboardHistoryEntry | null = null

    set((state) => {
      const result = moveLatestRedoToUndo(state.undoStack, state.redoStack)
      movedEntry = result.movedEntry

      return {
        undoStack: result.undoStack,
        redoStack: result.redoStack,
      }
    })

    return movedEntry
  },
  clearHistoryStacks: () => set(clearWhiteboardHistoryStacks()),
  undoLastOperation: () => {
    const state = get()

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot undo whiteboard operations.",
      })
      return
    }

    if (!state.roomId || !state.objectOperationSender) {
      set({
        mutationError: "Realtime connection is not ready.",
      })
      return
    }

    if (state.undoStack.length === 0) {
      return
    }

    enqueueMutation(async () => {
      const queuedState = get()
      const entry = queuedState.undoStack.at(-1)
      const inverseOperation = entry ? createUndoOperation(entry) : null

      if (!entry || !inverseOperation) {
        return
      }

      if (!queuedState.roomId || !queuedState.objectOperationSender) {
        set({
          mutationError: "Realtime connection is not ready.",
        })
        return
      }

      try {
        const operation = await queuedState.objectOperationSender.undoOperation(
          {
            boardId: queuedState.roomId,
            clientOpId: crypto.randomUUID(),
            inverseOperation,
          },
        )

        set((currentState) => {
          const latestEntry = currentState.undoStack.at(-1)

          if (!latestEntry || latestEntry.operationId !== entry.operationId) {
            return currentState
          }

          const redoEntry = createRedoStackEntryAfterUndo(
            latestEntry,
            operation,
          )

          if (!redoEntry) {
            return {
              mutationError: "Undo succeeded, but redo cannot be prepared.",
            }
          }

          return {
            undoStack: currentState.undoStack.slice(0, -1),
            redoStack: [...currentState.redoStack, redoEntry],
            mutationError: null,
          }
        })
      } catch (error) {
        handleUndoRedoOperationFailure(error, get, set)
      }
    })
  },
  redoLastOperation: () => {
    const state = get()

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot redo whiteboard operations.",
      })
      return
    }

    if (!state.roomId || !state.objectOperationSender) {
      set({
        mutationError: "Realtime connection is not ready.",
      })
      return
    }

    if (state.redoStack.length === 0) {
      return
    }

    enqueueMutation(async () => {
      const queuedState = get()
      const entry = queuedState.redoStack.at(-1)
      const redoOperation = entry ? createRedoOperation(entry) : null

      if (!entry || !redoOperation) {
        return
      }

      if (!queuedState.roomId || !queuedState.objectOperationSender) {
        set({
          mutationError: "Realtime connection is not ready.",
        })
        return
      }

      try {
        const operation = await queuedState.objectOperationSender.redoOperation(
          {
            boardId: queuedState.roomId,
            clientOpId: crypto.randomUUID(),
            redoOperation,
          },
        )

        set((currentState) => {
          const latestEntry = currentState.redoStack.at(-1)

          if (!latestEntry || latestEntry.operationId !== entry.operationId) {
            return currentState
          }

          const undoEntry = createUndoStackEntryAfterRedo(
            latestEntry,
            operation,
          )

          if (!undoEntry) {
            return {
              mutationError: "Redo succeeded, but undo cannot be prepared.",
            }
          }

          return {
            undoStack: [...currentState.undoStack, undoEntry],
            redoStack: currentState.redoStack.slice(0, -1),
            mutationError: null,
          }
        })
      } catch (error) {
        handleUndoRedoOperationFailure(error, get, set)
      }
    })
  },
})
