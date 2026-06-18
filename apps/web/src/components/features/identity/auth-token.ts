import { useAuthStore } from "@/stores/auth-store"

export function readStoredAuthToken(): string | null {
  return useAuthStore.getState().accessToken
}

export function writeStoredAuthToken(token: string): void {
  useAuthStore.getState().setAccessToken(token)
}

export function clearStoredAuthToken(): void {
  void useAuthStore.getState().logout()
}

export function subscribeStoredAuthToken(listener: () => void): () => void {
  return useAuthStore.subscribe((state, prevState) => {
    if (state.accessToken !== prevState.accessToken) {
      listener()
    }
  })
}
