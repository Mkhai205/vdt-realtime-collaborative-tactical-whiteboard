"use client"

import { useSyncExternalStore } from "react"
import { readStoredAuthToken, subscribeStoredAuthToken } from "./auth-token"
import { readStoredGuestIdentity, subscribeStoredGuestIdentity } from "./guest-identity"
import { GuestIdentityForm } from "./guest-identity-form"
import { RoomList } from "../rooms/room-list"

export function GuestIdentityGate() {
  const authToken = useSyncExternalStore(
    subscribeStoredAuthToken,
    readStoredAuthToken,
    () => null
  )
  const identity = useSyncExternalStore(
    subscribeStoredGuestIdentity,
    readStoredGuestIdentity,
    () => null
  )
  const isActive = Boolean(authToken) || Boolean(identity)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top nav bar */}
      <header className="h-14 shrink-0 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div className="size-7 rounded-md bg-foreground flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" className="text-background" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" className="text-background opacity-70" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" className="text-background opacity-50" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" className="text-background opacity-30" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">Tactical Whiteboard</span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 presence-pulse" aria-hidden="true" />
              Session active
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex">
        {/* Left sidebar — Identity / Auth */}
        <aside className="w-[380px] shrink-0 border-r bg-card flex flex-col p-8 gap-8">
          {/* Branding block */}
          <div className="flex flex-col gap-2 pt-4">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
              Collaborative Canvas
            </p>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-foreground">
              Set up your session
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Identify yourself to join or create a whiteboard room. Google sign-in upgrades your session with authenticated identity.
            </p>
          </div>

          {/* Identity form */}
          <GuestIdentityForm />

          {/* Footer */}
          <div className="mt-auto pt-6 border-t">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your identity is stored locally in this browser. It will be reused across sessions for realtime presence.
            </p>
          </div>
        </aside>

        {/* Right — Rooms dashboard */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {isActive ? (
            <RoomList />
          ) : (
            /* Placeholder when not yet active */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12 text-center">
              <div className="flex flex-col items-center gap-4 max-w-sm">
                {/* Grid illustration */}
                <div className="size-20 rounded-2xl bg-muted flex items-center justify-center">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <rect x="4" y="4" width="13" height="13" rx="2" fill="currentColor" className="text-muted-foreground opacity-30" />
                    <rect x="23" y="4" width="13" height="13" rx="2" fill="currentColor" className="text-muted-foreground opacity-60" />
                    <rect x="4" y="23" width="13" height="13" rx="2" fill="currentColor" className="text-muted-foreground opacity-60" />
                    <rect x="23" y="23" width="13" height="13" rx="2" fill="currentColor" className="text-muted-foreground opacity-90" />
                  </svg>
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Your rooms will appear here
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Set up your identity on the left to access whiteboard rooms and start collaborating.
                  </p>
                </div>
              </div>
              {/* Feature hints */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-4">
                {[
                  { label: "Realtime sync", desc: "Changes appear instantly for all collaborators" },
                  { label: "Cursor presence", desc: "See where others are pointing on the canvas" },
                  { label: "Undo / Redo", desc: "Per-user operation history with full recovery" },
                ].map((feat) => (
                  <div key={feat.label} className="flex flex-col gap-1.5 p-4 rounded-xl border bg-card text-left">
                    <p className="text-xs font-semibold text-foreground">{feat.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
