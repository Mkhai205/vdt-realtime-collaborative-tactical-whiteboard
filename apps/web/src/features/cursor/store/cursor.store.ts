import { create } from "zustand"

export interface RemoteCursorData {
  userId: string
  name: string
  avatarUrl?: string
  avatarColor: string
  x: number  // world coordinates
  y: number
  lastActive: number // timestamp
}

interface CursorStore {
  cursors: Map<string, RemoteCursorData>
  updateCursor: (userId: string, data: Omit<RemoteCursorData, "userId">) => void
  removeCursor: (userId: string) => void
  clearAll: () => void
}

// Module-level map to keep track of setTimeout IDs for each user's cursor decay
const activeTimeouts = new Map<string, NodeJS.Timeout>()

export const useCursorStore = create<CursorStore>()((set, get) => ({
  cursors: new Map(),

  updateCursor: (userId, data) => {
    set((state) => {
      const next = new Map(state.cursors)
      next.set(userId, { ...data, userId })

      // Clear existing timeout for this user
      const existingTimeout = activeTimeouts.get(userId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      // Schedule a new timeout to clean up after 3s of inactivity
      const timeout = setTimeout(() => {
        get().removeCursor(userId)
      }, 3000)

      activeTimeouts.set(userId, timeout)

      return { cursors: next }
    })
  },

  removeCursor: (userId) => {
    // Clean up timeout
    const timeout = activeTimeouts.get(userId)
    if (timeout) {
      clearTimeout(timeout)
      activeTimeouts.delete(userId)
    }

    set((state) => {
      const next = new Map(state.cursors)
      const deleted = next.delete(userId)
      if (!deleted) return state // avoid re-render if nothing changed
      return { cursors: next }
    })
  },

  clearAll: () => {
    // Clear all timeouts
    for (const timeout of activeTimeouts.values()) {
      clearTimeout(timeout)
    }
    activeTimeouts.clear()

    set({ cursors: new Map() })
  },
}))
