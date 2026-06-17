import { guestIdentityStorageKey } from "@rctw/shared-contracts"

const guestIdentityChangeEvent = "rctw:guest-identity-change"
let cachedRawGuestIdentity: string | null = null
let cachedGuestIdentity: GuestIdentity | null = null

export function createGuestIdentity(
  displayName: string,
  existingIdentity?: GuestIdentity | null,
): GuestIdentity {
  const id = existingIdentity?.id ?? crypto.randomUUID()
  const avatarColor =
    existingIdentity?.avatarColor ?? generateGuestAvatarColor(id)

  return guestIdentitySchema.parse({
    id,
    name: displayName,
    avatarColor,
  })
}

export function generateGuestAvatarColor(seed: string): string {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return avatarPalette[hash % avatarPalette.length] ?? avatarPalette[0]
}

export function readStoredGuestIdentity(): GuestIdentity | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const rawValue = localStorage.getItem(guestIdentityStorageKey)

  if (!rawValue) {
    cachedRawGuestIdentity = null
    cachedGuestIdentity = null
    return null
  }

  if (rawValue === cachedRawGuestIdentity) {
    return cachedGuestIdentity
  }

  try {
    const parsed = guestIdentitySchema.safeParse(JSON.parse(rawValue))
    cachedRawGuestIdentity = rawValue
    cachedGuestIdentity = parsed.success ? parsed.data : null
    return cachedGuestIdentity
  } catch {
    cachedRawGuestIdentity = rawValue
    cachedGuestIdentity = null
    return null
  }
}

export function writeStoredGuestIdentity(identity: GuestIdentity): void {
  if (!canUseLocalStorage()) {
    return
  }

  const parsed = guestIdentitySchema.parse(identity)
  localStorage.setItem(guestIdentityStorageKey, JSON.stringify(parsed))
  emitGuestIdentityChange()
}

export const guestTokenStorageKey = "rctw.guestToken.v1"

export function readStoredGuestToken(): string | null {
  if (!canUseLocalStorage()) {
    return null
  }
  return localStorage.getItem(guestTokenStorageKey)?.trim() || null
}

export function writeStoredGuestToken(token: string): void {
  if (!canUseLocalStorage()) {
    return
  }
  localStorage.setItem(guestTokenStorageKey, token.trim())
  emitGuestTokenChange()
}

export function clearStoredGuestToken(): void {
  if (!canUseLocalStorage()) {
    return
  }
  localStorage.removeItem(guestTokenStorageKey)
  emitGuestTokenChange()
}

export function clearStoredGuestIdentity(): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.removeItem(guestIdentityStorageKey)
  localStorage.removeItem(guestTokenStorageKey)
  emitGuestIdentityChange()
  emitGuestTokenChange()
}

export function getGuestRestHeaders(): AuthRestHeaders | Record<string, never> {
  const token = readStoredGuestToken()
  return token ? buildBearerAuthHeader(token) : {}
}

export function getGuestSocketAuth():
  | SocketAuthPayload
  | Record<string, never> {
  const token = readStoredGuestToken()
  return token ? buildJwtSocketAuth(token) : {}
}

export function subscribeStoredGuestIdentity(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined
  }

  window.addEventListener("storage", listener)
  window.addEventListener(guestIdentityChangeEvent, listener)

  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener(guestIdentityChangeEvent, listener)
  }
}

const guestTokenChangeEvent = "rctw:guest-token-change"

export function subscribeStoredGuestToken(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined
  }

  window.addEventListener("storage", listener)
  window.addEventListener(guestTokenChangeEvent, listener)

  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener(guestTokenChangeEvent, listener)
  }
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window
}

function emitGuestIdentityChange(): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(guestIdentityChangeEvent))
}

function emitGuestTokenChange(): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(guestTokenChangeEvent))
}
