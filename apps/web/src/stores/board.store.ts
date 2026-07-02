import { create } from "zustand"
import type {
  BoardObjectDto,
  BoardStateEvent,
  OnlineUser,
  PresenceUpdateEvent,
  UndoRedoEvent,
  UserSummary,
  EffectiveBoardRole,
} from "@rctw/shared-contracts"

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Saved snapshot of an object before an optimistic mutation */
export type OptimisticOp = {
  /** Original object state before the mutation (null = the object didn't exist) */
  originalState: BoardObjectDto | null
}

export type EditingStateEntry = {
  user: UserSummary
  timestamp: string
}

// ─── State & Actions Interface ─────────────────────────────────────────────────

interface BoardState {
  // ── Canvas data ──
  boardId: string | null
  boardName: string
  boardDescription: string | null
  boardVisibility: "PRIVATE" | "PUBLIC"
  /** Map of objectId → BoardObjectDto for O(1) lookups */
  objects: Map<string, BoardObjectDto>
  /** Latest room-level revision the client knows about */
  revision: number

  // ── Collaboration ──
  onlineUsers: OnlineUser[]
  currentUser: OnlineUser | null
  effectiveRole: EffectiveBoardRole | null
  /** Map of objectId → who is currently editing it */
  editingStates: Map<string, EditingStateEntry>

  // ── Optimistic concurrency ──
  /** Map of clientOpId → original object state for rollback */
  pendingOps: Map<string, OptimisticOp>
}

interface BoardActions {
  /**
   * Initialise (or reset) the board store from the `board:state` server event.
   * Called once immediately after joining a board room.
   */
  initBoard: (event: BoardStateEvent) => void

  /** Update the board's name and description locally */
  updateBoardInfo: (name: string, description: string | null) => void

  /** Update the board's visibility locally */
  updateBoardVisibility: (visibility: "PRIVATE" | "PUBLIC") => void

  /** Upsert (add or replace) a single object in the map */
  upsertObject: (obj: BoardObjectDto) => void

  /** Remove an object from the map (soft delete already handled by server) */
  removeObject: (objectId: string) => void

  /**
   * Apply an undo/redo broadcast from the server.
   * - event.object !== null  → upsert the object
   * - event.object === null  → remove it
   */
  applyUndoRedo: (event: UndoRedoEvent) => void

  /** Replace the online user list wholesale */
  setOnlineUsers: (users: OnlineUser[]) => void

  /** Handle a presence:update event (includes full updated user list) */
  updatePresence: (event: PresenceUpdateEvent) => void

  /**
   * Set or clear the editing awareness entry for an object.
   * Pass null to clear.
   */
  setEditingState: (objectId: string, entry: EditingStateEntry | null) => void

  /** Advance the revision counter */
  setRevision: (revision: number) => void

  // ── Optimistic ops ──

  /** Record the original state of an object before sending a mutation */
  addPendingOp: (clientOpId: string, originalState: BoardObjectDto | null) => void

  /** ACK received — discard the saved snapshot */
  commitPendingOp: (clientOpId: string) => void

  /** Error received — restore the object to its original state */
  rollbackPendingOp: (clientOpId: string) => void

  /** Reset the entire board store (called when leaving a board) */
  resetBoard: () => void
}

type BoardStore = BoardState & BoardActions

// ─── Initial State ─────────────────────────────────────────────────────────────

const initialState: BoardState = {
  boardId: null,
  boardName: "",
  boardDescription: null,
  boardVisibility: "PRIVATE",
  objects: new Map(),
  revision: 0,
  onlineUsers: [],
  currentUser: null,
  effectiveRole: null,
  editingStates: new Map(),
  pendingOps: new Map(),
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useBoardStore = create<BoardStore>()((set, get) => ({
  ...initialState,

  initBoard: (event) => {
    const objectsMap = new Map<string, BoardObjectDto>()
    for (const obj of event.objects) {
      objectsMap.set(obj.id, obj)
    }

    const editingMap = new Map<string, EditingStateEntry>()
    for (const entry of event.editingStates) {
      editingMap.set(entry.objectId, {
        user: entry.user,
        timestamp: new Date().toISOString(),
      })
    }

    set({
      boardId: event.board.id,
      boardName: event.board.name,
      boardDescription: event.board.description || null,
      boardVisibility: event.board.visibility,
      currentUser: event.currentUser || null,
      effectiveRole: event.currentUser?.effectiveRole || "VIEWER",
      objects: objectsMap,
      revision: event.board.currentRevision,
      onlineUsers: event.onlineUsers,
      editingStates: editingMap,
      pendingOps: new Map(),
    })
  },

  updateBoardInfo: (name, description) => {
    set({
      boardName: name,
      boardDescription: description,
    })
  },

  updateBoardVisibility: (visibility) => {
    set({
      boardVisibility: visibility,
    })
  },

  upsertObject: (obj) => {
    set((state) => {
      const next = new Map(state.objects)
      next.set(obj.id, obj)
      return { objects: next }
    })
  },

  removeObject: (objectId) => {
    set((state) => {
      const next = new Map(state.objects)
      next.delete(objectId)
      return { objects: next }
    })
  },

  applyUndoRedo: (event) => {
    if (event.object !== null) {
      get().upsertObject(event.object)
    } else {
      get().removeObject(event.objectId)
    }
    // Bump revision to the operation's revision
    const opRevision = event.operation.revision
    if (opRevision > get().revision) {
      set({ revision: opRevision })
    }
  },

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  updatePresence: (event) => set({ onlineUsers: event.onlineUsers }),

  setEditingState: (objectId, entry) => {
    set((state) => {
      const next = new Map(state.editingStates)
      if (entry === null) {
        next.delete(objectId)
      } else {
        next.set(objectId, entry)
      }
      return { editingStates: next }
    })
  },

  setRevision: (revision) => set({ revision }),

  addPendingOp: (clientOpId, originalState) => {
    set((state) => {
      const next = new Map(state.pendingOps)
      next.set(clientOpId, { originalState })
      return { pendingOps: next }
    })
  },

  commitPendingOp: (clientOpId) => {
    set((state) => {
      const next = new Map(state.pendingOps)
      next.delete(clientOpId)
      return { pendingOps: next }
    })
  },

  rollbackPendingOp: (clientOpId) => {
    const op = get().pendingOps.get(clientOpId)
    if (!op) return

    if (op.originalState === null) {
      // The object was newly created — remove it
      // We don't know the temp id here, so callers should clean up themselves
    } else {
      // Restore original state
      get().upsertObject(op.originalState)
    }

    set((state) => {
      const next = new Map(state.pendingOps)
      next.delete(clientOpId)
      return { pendingOps: next }
    })
  },

  resetBoard: () => set({ ...initialState }),
}))
