import { create } from "zustand"

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface RemoteLaserPoint {
  x: number   // world coordinates
  y: number
  t: number   // timestamp
}

export interface RemoteLaserData {
  userId: string
  name: string
  avatarColor: string
  /** Map of strokeId -> points */
  strokes: Map<string, RemoteLaserPoint[]>
  lastActive: number
}

// ─── Store ──────────────────────────────────────────────────────────────────────

interface LaserStore {
  /** Active laser trails keyed by userId */
  lasers: Map<string, RemoteLaserData>

  addLaserPoint: (userId: string, name: string, avatarColor: string, x: number, y: number, strokeId?: string) => void
  clearLaser: (userId: string) => void
  clearAll: () => void
}

// Module-level cleanup timers
const laserTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const TRAIL_DURATION_MS = 1000
const MAX_REMOTE_POINTS = 150

export const useLaserStore = create<LaserStore>()((set, get) => ({
  lasers: new Map(),

  addLaserPoint: (userId, name, avatarColor, x, y, strokeId = "default") => {
    const now = Date.now()

    set((state) => {
      const next = new Map(state.lasers)
      const existing = next.get(userId) ?? {
        userId,
        name,
        avatarColor,
        strokes: new Map<string, RemoteLaserPoint[]>(),
        lastActive: now,
      }
      const newPoint: RemoteLaserPoint = { x, y, t: now }

      const strokePoints = existing.strokes.get(strokeId) ?? []
      const pruned = strokePoints.filter((p) => now - p.t < TRAIL_DURATION_MS)
      pruned.push(newPoint)

      const capped = pruned.length > MAX_REMOTE_POINTS ? pruned.slice(-MAX_REMOTE_POINTS) : pruned
      existing.strokes.set(strokeId, capped)

      next.set(userId, {
        ...existing,
        name,
        avatarColor,
        strokes: existing.strokes,
        lastActive: now,
      })
      return { lasers: next }
    })

    // Reset inactivity timeout — remove after 3s of no updates
    const existing = laserTimeouts.get(userId)
    if (existing) clearTimeout(existing)
    laserTimeouts.set(
      userId,
      setTimeout(() => get().clearLaser(userId), 3000),
    )
  },

  clearLaser: (userId) => {
    const t = laserTimeouts.get(userId)
    if (t) { clearTimeout(t); laserTimeouts.delete(userId) }

    set((state) => {
      const next = new Map(state.lasers)
      if (!next.delete(userId)) return state
      return { lasers: next }
    })
  },

  clearAll: () => {
    for (const t of laserTimeouts.values()) clearTimeout(t)
    laserTimeouts.clear()
    set({ lasers: new Map() })
  },
}))
