import {
  authTokenStorageKey,
  buildBearerAuthHeader,
  buildJwtSocketAuth,
  type AuthRestHeaders,
  type SocketAuthPayload,
} from "@rctw/shared-contracts"
import { getGuestSocketAuth } from "./guest-identity"

const authTokenChangeEvent = "rctw:auth-token-change"

export function readStoredAuthToken(): string | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const token = localStorage.getItem(authTokenStorageKey)?.trim()

  return token || null
}

export function writeStoredAuthToken(token: string): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.setItem(authTokenStorageKey, token.trim())
  emitAuthTokenChange()
}

export function clearStoredAuthToken(): void {
  if (!canUseLocalStorage()) {
    return
  }

  localStorage.removeItem(authTokenStorageKey)
  emitAuthTokenChange()
}

export function getAuthRestHeaders(): AuthRestHeaders | Record<string, never> {
  const token = readStoredAuthToken()

  return token ? buildBearerAuthHeader(token) : {}
}

export function getAuthSocketAuth():
  | SocketAuthPayload
  | Record<string, never> {
  const token = readStoredAuthToken()

  return token ? buildJwtSocketAuth(token) : {}
}

export function getIdentitySocketAuth():
  | SocketAuthPayload
  | Record<string, never> {
  const tokenAuth = getAuthSocketAuth()

  if ("token" in tokenAuth) {
    return tokenAuth
  }

  return getGuestSocketAuth()
}

export function subscribeStoredAuthToken(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined
  }

  window.addEventListener("storage", listener)
  window.addEventListener(authTokenChangeEvent, listener)

  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener(authTokenChangeEvent, listener)
  }
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window
}

function emitAuthTokenChange(): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(authTokenChangeEvent))
}
