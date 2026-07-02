import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { UserSummary } from "@rctw/shared-contracts"

// ─── State & Actions Interface ─────────────────────────────────────────────────

interface AuthState {
  /** Authenticated user profile */
  user: UserSummary | null
  /** JWT access token (short-lived, ~15 min) */
  accessToken: string | null
  /**
   * True while the app is bootstrapping auth on first mount
   * (e.g., trying a silent token refresh before deciding to redirect).
   */
  isLoading: boolean
}

interface AuthActions {
  /** Set both user profile and access token after a successful login / refresh */
  setAuth: (user: UserSummary, accessToken: string) => void
  /** Update only the access token (used after a silent refresh) */
  setAccessToken: (token: string) => void
  /** Clear all auth state (logout) */
  clearAuth: () => void
  /** Toggle the bootstrapping loading flag */
  setIsLoading: (loading: boolean) => void
}

type AuthStore = AuthState & AuthActions

// ─── Selectors ─────────────────────────────────────────────────────────────────

/** Derived selector — true when there is a stored access token */
export const selectIsAuthenticated = (state: AuthStore): boolean =>
  !!state.accessToken

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // ── State ──
      user: null,
      accessToken: null,
      isLoading: true,

      // ── Actions ──
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isLoading: false }),

      setAccessToken: (accessToken) => set({ accessToken }),

      clearAuth: () =>
        set({ user: null, accessToken: null, isLoading: false }),

      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "rctw-auth",
      storage: createJSONStorage(() => localStorage),
      /**
       * Only persist user profile and accessToken.
       * isLoading is always re-derived on mount.
       */
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
)

// ─── Convenience hook ─────────────────────────────────────────────────────────

/** Returns true when the user has a valid access token */
export function useIsAuthenticated(): boolean {
  return useAuthStore(selectIsAuthenticated)
}
