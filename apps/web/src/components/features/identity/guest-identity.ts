import { avatarPalette } from "@rctw/shared-contracts"
import { useAuthStore } from "@/stores/auth-store"

export type GuestIdentity = {
  id: string
  name: string
  avatarColor: string
}

export function createGuestIdentity(
  displayName: string,
  existingIdentity?: GuestIdentity | null,
): GuestIdentity {
  const id = existingIdentity?.id || crypto.randomUUID()
  const avatarColor =
    existingIdentity?.avatarColor || generateGuestAvatarColor(id)

  return {
    id,
    name: displayName,
    avatarColor,
  }
}

export function generateGuestAvatarColor(seed: string): string {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return avatarPalette[hash % avatarPalette.length] ?? avatarPalette[0]
}

export function readStoredGuestIdentity(): GuestIdentity | null {
  const user = useAuthStore.getState().user
  if (user && user.identityType === "GUEST") {
    return {
      id: user.id,
      name: user.name,
      avatarColor: user.avatarColor || "#3B82F6",
    }
  }
  return null
}

export function writeStoredGuestIdentity(identity: GuestIdentity): void {
  // Deprecated: Zustand handles the identity state via access token
  void identity
}

export function readStoredGuestToken(): string | null {
  const state = useAuthStore.getState()
  if (state.user && state.user.identityType === "GUEST") {
    return state.accessToken
  }
  return null
}

export function writeStoredGuestToken(token: string): void {
  useAuthStore.getState().setAccessToken(token)
}

export function clearStoredGuestToken(): void {
  void useAuthStore.getState().logout()
}

export function clearStoredGuestIdentity(): void {
  void useAuthStore.getState().logout()
}

export function getGuestRestHeaders(): Record<string, string> {
  const token = readStoredGuestToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getGuestSocketAuth(): { token: string } | Record<string, never> {
  const token = readStoredGuestToken()
  return token ? { token } : {}
}

export function subscribeStoredGuestIdentity(listener: () => void): () => void {
  return useAuthStore.subscribe((state, prevState) => {
    const isGuest = state.user?.identityType === "GUEST"
    const wasGuest = prevState.user?.identityType === "GUEST"
    const isDifferent =
      state.user?.id !== prevState.user?.id ||
      state.user?.name !== prevState.user?.name ||
      state.user?.avatarColor !== prevState.user?.avatarColor

    if (isGuest !== wasGuest || (isGuest && isDifferent)) {
      listener()
    }
  })
}

export function subscribeStoredGuestToken(listener: () => void): () => void {
  return useAuthStore.subscribe((state, prevState) => {
    const isGuest = state.user?.identityType === "GUEST"
    const wasGuest = prevState.user?.identityType === "GUEST"
    if (isGuest !== wasGuest || (isGuest && state.accessToken !== prevState.accessToken)) {
      listener()
    }
  })
}
