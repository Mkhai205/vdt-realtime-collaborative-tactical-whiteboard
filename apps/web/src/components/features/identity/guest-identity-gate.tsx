"use client"

import { useSyncExternalStore } from "react"
import { readStoredAuthToken, subscribeStoredAuthToken } from "./auth-token"
import {
  readStoredGuestToken,
  subscribeStoredGuestToken,
} from "./guest-identity"
import { GuestIdentityForm } from "./guest-identity-form"
import { RoomList } from "../rooms/room-list"

export function GuestIdentityGate() {
  const authToken = useSyncExternalStore(
    subscribeStoredAuthToken,
    readStoredAuthToken,
    () => null,
  )
  const guestToken = useSyncExternalStore(
    subscribeStoredGuestToken,
    readStoredGuestToken,
    () => null,
  )
  const isActive = Boolean(authToken) || Boolean(guestToken)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top nav bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div className="flex size-7 items-center justify-center rounded-md bg-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="1"
                y="1"
                width="5"
                height="5"
                rx="1"
                fill="currentColor"
                className="text-background"
              />
              <rect
                x="8"
                y="1"
                width="5"
                height="5"
                rx="1"
                fill="currentColor"
                className="text-background opacity-70"
              />
              <rect
                x="1"
                y="8"
                width="5"
                height="5"
                rx="1"
                fill="currentColor"
                className="text-background opacity-50"
              />
              <rect
                x="8"
                y="8"
                width="5"
                height="5"
                rx="1"
                fill="currentColor"
                className="text-background opacity-30"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Tactical Whiteboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="presence-pulse size-1.5 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              Session active
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1">
        {/* Left sidebar — Identity / Auth */}
        <aside className="flex w-95 shrink-0 flex-col gap-8 border-r bg-card p-8">
          {/* Branding block */}
          <div className="flex flex-col gap-2 pt-4">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Collaborative Canvas
            </p>
            <h1 className="text-2xl leading-snug font-semibold tracking-tight text-foreground">
              Set up your session
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Identify yourself to join or create a whiteboard room. Google
              sign-in upgrades your session with authenticated identity.
            </p>
          </div>

          {/* Identity form */}
          <GuestIdentityForm />

          {/* Footer */}
          <div className="mt-auto border-t pt-6">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your identity is stored locally in this browser. It will be reused
              across sessions for realtime presence.
            </p>
          </div>
        </aside>

        {/* Right — Rooms dashboard */}
        <section className="flex flex-1 flex-col overflow-hidden">
          {isActive ? (
            <RoomList />
          ) : (
            /* Placeholder when not yet active */
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
              <div className="flex max-w-sm flex-col items-center gap-4">
                {/* Grid illustration */}
                <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <rect
                      x="4"
                      y="4"
                      width="13"
                      height="13"
                      rx="2"
                      fill="currentColor"
                      className="text-muted-foreground opacity-30"
                    />
                    <rect
                      x="23"
                      y="4"
                      width="13"
                      height="13"
                      rx="2"
                      fill="currentColor"
                      className="text-muted-foreground opacity-60"
                    />
                    <rect
                      x="4"
                      y="23"
                      width="13"
                      height="13"
                      rx="2"
                      fill="currentColor"
                      className="text-muted-foreground opacity-60"
                    />
                    <rect
                      x="23"
                      y="23"
                      width="13"
                      height="13"
                      rx="2"
                      fill="currentColor"
                      className="text-muted-foreground opacity-90"
                    />
                  </svg>
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Your rooms will appear here
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Set up your identity on the left to access whiteboard rooms
                    and start collaborating.
                  </p>
                </div>
              </div>
              {/* Feature hints */}
              <div className="mt-4 grid w-full max-w-lg grid-cols-3 gap-4">
                {[
                  {
                    label: "Realtime sync",
                    desc: "Changes appear instantly for all collaborators",
                  },
                  {
                    label: "Cursor presence",
                    desc: "See where others are pointing on the canvas",
                  },
                  {
                    label: "Undo / Redo",
                    desc: "Per-user operation history with full recovery",
                  },
                ].map((feat) => (
                  <div
                    key={feat.label}
                    className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left"
                  >
                    <p className="text-xs font-semibold text-foreground">
                      {feat.label}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {feat.desc}
                    </p>
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
