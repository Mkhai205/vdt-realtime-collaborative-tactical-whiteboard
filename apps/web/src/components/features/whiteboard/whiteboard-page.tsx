"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { Tool } from "@rctw/shared-contracts"
import {
  CircleIcon,
  HandIcon,
  HistoryIcon,
  type LucideIcon,
  MinusIcon,
  MousePointer2Icon,
  MoveRightIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlusIcon,
  Redo2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  UsersRoundIcon,
  XIcon,
  ClipboardCopyIcon,
  ChevronRightIcon,
  SmileIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  maxViewportScale,
  minViewportScale,
  viewportZoomStep,
} from "@/lib/canvas-utils"
import { isEditableEventTarget } from "@/lib/dom-utils"
import { useShallow } from "zustand/react/shallow"
import {
  type WhiteboardToast,
  useWhiteboardStore,
} from "@/stores/whiteboard-store"
import {
  selectPageState,
  selectPageActions,
  selectToolbarState,
} from "@/stores/whiteboard-store/selectors"
import { ObjectDetailPanel } from "./object-detail-panel"
import { OnlineUsersPanel } from "./online-users-panel"
import { OperationHistoryPanel } from "./operation-history-panel"
import { useWhiteboardRoomSocket } from "./use-whiteboard-room-socket"
import { canEditRoom } from "@/lib/room-utils"
import { cn } from "@/lib/utils"

const WhiteboardStage = dynamic(
  () => import("./whiteboard-stage").then((module) => module.WhiteboardStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Preparing canvas…
      </div>
    ),
  },
)

const toolbarItems = [
  { value: "SELECT", label: "Select", icon: MousePointer2Icon, shortcut: "V" },
  { value: "RECTANGLE", label: "Rectangle", icon: SquareIcon, shortcut: "R" },
  { value: "CIRCLE", label: "Circle", icon: CircleIcon, shortcut: "C" },
  { value: "LINE", label: "Line", icon: MoveRightIcon, shortcut: "L" },
  { value: "TEXT", label: "Text", icon: TypeIcon, shortcut: "T" },
  { value: "ICON", label: "Icon", icon: SmileIcon, shortcut: "I" },
  { value: "HAND", label: "Pan", icon: HandIcon, shortcut: "H" },
] as const satisfies ReadonlyArray<{
  value: Tool
  label: string
  icon: LucideIcon
  shortcut: string
}>

const viewportScaleEpsilon = 0.001
const toastAutoDismissMs = 5000
type LoadState = "loading" | "ready" | "error"
type RightPanelTab = "users" | "details" | "history"

export function WhiteboardPage({ roomId }: { roomId: string }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("details")

  const {
    room,
    currentUser,
    currentRevision,
    connectionStatus,
    socketError,
    onlineUsers,
    mutationError,
    toasts,
    viewport,
  } = useWhiteboardStore(useShallow(selectPageState))

  const {
    deleteSelectedObject,
    undoLastOperation,
    redoLastOperation,
    dismissToast,
  } = useWhiteboardStore(useShallow(selectPageActions))

  const hasLoadedRoom = room?.id === roomId && Boolean(currentUser)
  const loadState: LoadState =
    socketError && !hasLoadedRoom
      ? "error"
      : hasLoadedRoom
        ? "ready"
        : "loading"

  useWhiteboardRoomSocket(roomId)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableEventTarget(event.target)) {
        return
      }

      const state = useWhiteboardStore.getState()
      const role = state.currentUser?.role
      const canEdit = canEditRoom(role)
      const key = event.key.toLowerCase()
      const isUndoShortcut =
        (event.metaKey || event.ctrlKey) && !event.altKey && key === "z"
      const isRedoShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (key === "y" || (key === "z" && event.shiftKey))

      if (canEdit && isRedoShortcut && state.redoStack.length > 0) {
        event.preventDefault()
        redoLastOperation()
        return
      }

      if (
        canEdit &&
        isUndoShortcut &&
        !event.shiftKey &&
        state.undoStack.length > 0
      ) {
        event.preventDefault()
        undoLastOperation()
        return
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return
      }

      if (!state.selectedObjectId || !canEdit) {
        return
      }

      event.preventDefault()
      deleteSelectedObject()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [deleteSelectedObject, redoLastOperation, undoLastOperation])

  const isConnected = connectionStatus === "connected" && hasLoadedRoom

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* ── Slim top header ─────────────────────────────────── */}
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b bg-card/80 px-4 backdrop-blur-sm">
        {/* Left: Logo + room info */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Logo mark */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2"
            aria-label="Back to rooms"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground transition-opacity group-hover:opacity-70">
              <svg
                width="12"
                height="12"
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
          </Link>

          <span className="text-border" aria-hidden="true">
            /
          </span>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {room?.name ?? "Loading…"}
            </span>
            {currentUser?.role && (
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {currentUser.role}
              </span>
            )}
          </div>
        </div>

        {/* Center: Connection + revision status */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                socketError
                  ? "bg-destructive"
                  : isConnected
                    ? "presence-pulse bg-emerald-500"
                    : "presence-pulse bg-amber-400",
              )}
              aria-hidden="true"
            />
            <span className="hidden sm:block">
              {socketError
                ? "Error"
                : isConnected
                  ? "Live"
                  : formatConnectionStatus(connectionStatus)}
            </span>
          </div>

          <span className="hidden text-border md:block" aria-hidden="true">
            ·
          </span>
          <span className="hidden font-mono md:block">
            Rev {currentRevision}
          </span>
          <span className="hidden text-border md:block" aria-hidden="true">
            ·
          </span>
          <span className="hidden md:block">
            {Math.round(viewport.scale * 100)}%
          </span>
        </div>

        {/* Right: Presence + panel toggle */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Presence avatars (compact) */}
          {onlineUsers.length > 0 && (
            <button
              type="button"
              className="flex items-center -space-x-1.5 transition-opacity hover:opacity-80"
              onClick={() => {
                setRightPanelOpen(true)
                setRightPanelTab("users")
              }}
              title={`${onlineUsers.length} user${onlineUsers.length !== 1 ? "s" : ""} online`}
              aria-label={`${onlineUsers.length} users online — click to view`}
            >
              {onlineUsers.slice(0, 4).map((user) => (
                <PresenceAvatar key={user.id} user={user} />
              ))}
              {onlineUsers.length > 4 && (
                <span className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-semibold text-muted-foreground">
                  +{onlineUsers.length - 4}
                </span>
              )}
            </button>
          )}

          {/* Share button */}
          <CopyRoomLinkButton roomId={roomId} />

          {/* Panel toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                aria-label={rightPanelOpen ? "Collapse panel" : "Expand panel"}
              >
                {rightPanelOpen ? (
                  <PanelRightCloseIcon className="size-4" aria-hidden="true" />
                ) : (
                  <PanelRightOpenIcon className="size-4" aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {rightPanelOpen ? "Hide panel" : "Show panel"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* ── Main content area ────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Canvas area */}
        <main
          className="canvas-dot-grid relative min-w-0 flex-1 overflow-hidden bg-background"
          aria-label="Whiteboard canvas"
        >
          <WhiteboardStage />

          {/* Floating toolbar — top center */}
          <FloatingToolbar />

          {/* Zoom controls — bottom left */}
          <ZoomControls />

          {/* Loading overlay */}
          {loadState === "loading" && <StatusOverlay message="Joining room…" />}

          {/* Error overlay */}
          {loadState === "error" && (
            <StatusOverlay
              message={socketError ?? "Socket connection failed."}
            />
          )}

          {/* Inline errors (when already loaded) */}
          {((socketError && hasLoadedRoom) || mutationError) && (
            <div className="absolute top-18 left-1/2 z-20 flex max-w-md -translate-x-1/2 flex-col gap-2">
              {socketError && hasLoadedRoom && (
                <StatusMessage message={socketError} />
              )}
              {mutationError && <StatusMessage message={mutationError} />}
            </div>
          )}

          {/* Toast notifications */}
          <WhiteboardToastViewport toasts={toasts} onDismiss={dismissToast} />
        </main>

        {/* ── Right panel (collapsible) ─────────────────────── */}
        <aside
          className={cn(
            "flex shrink-0 flex-col overflow-hidden border-l bg-card transition-all duration-200 ease-out",
            rightPanelOpen ? "panel-slide-in w-72" : "w-0",
          )}
          aria-label="Room details panel"
          aria-hidden={!rightPanelOpen}
        >
          {rightPanelOpen && (
            <RightPanel
              roomId={roomId}
              currentRevision={currentRevision}
              activeTab={rightPanelTab}
              onTabChange={setRightPanelTab}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

/* ─── Floating Toolbar ──────────────────────────────────────── */

function FloatingToolbar() {
  const { currentTool, selectedObjectId, undoCount, redoCount, role } =
    useWhiteboardStore(useShallow(selectToolbarState))

  const {
    deleteSelectedObject,
    undoLastOperation,
    redoLastOperation,
    setTool,
  } = useWhiteboardStore(useShallow(selectPageActions))

  const canEdit = canEditRoom(role)
  const canDelete = canEdit && Boolean(selectedObjectId)
  const canUndo = canEdit && undoCount > 0
  const canRedo = canEdit && redoCount > 0

  return (
    <div
      className="shadow-toolbar toolbar-float-in absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-card px-1.5 py-1.5"
      role="toolbar"
      aria-label="Whiteboard tools"
    >
      {/* Drawing tools */}
      {toolbarItems.map((item) => {
        const Icon = item.icon
        const isActive = currentTool === item.value
        const isDisabled = !canEdit && isEditTool(item.value)

        return (
          <Tooltip key={item.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setTool(item.value as Tool)}
                disabled={isDisabled}
                aria-label={item.label}
                aria-pressed={isActive}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  "disabled:pointer-events-none disabled:opacity-30",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="flex items-center gap-2 text-xs"
            >
              {item.label}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                {item.shortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
        )
      })}

      {/* Divider */}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      {/* Action buttons */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={undoLastOperation}
            disabled={!canUndo}
            aria-label="Undo"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-30",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Undo2Icon className="size-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="flex items-center gap-2 text-xs"
        >
          Undo
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⌘Z
          </kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={redoLastOperation}
            disabled={!canRedo}
            aria-label="Redo"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-30",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Redo2Icon className="size-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="flex items-center gap-2 text-xs"
        >
          Redo
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⌘Y
          </kbd>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      {/* Delete */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={deleteSelectedObject}
            disabled={!canDelete}
            aria-label="Delete selected"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-30",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            )}
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="flex items-center gap-2 text-xs"
        >
          Delete
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Del
          </kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/* ─── Right Panel ───────────────────────────────────────────── */

function RightPanel({
  roomId,
  currentRevision,
  activeTab,
  onTabChange,
}: {
  roomId: string
  currentRevision: number
  activeTab: RightPanelTab
  onTabChange: (tab: RightPanelTab) => void
}) {
  const tabs: { id: RightPanelTab; label: string; icon: LucideIcon }[] = [
    { id: "details", label: "Details", icon: ChevronRightIcon },
    { id: "users", label: "Users", icon: UsersRoundIcon },
    { id: "history", label: "History", icon: HistoryIcon },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Panel tab bar */}
      <div className="flex shrink-0 items-center gap-0.5 border-b px-2 pt-2 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                activeTab === tab.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Panel content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "details" && <ObjectDetailPanel />}
        {activeTab === "users" && <OnlineUsersPanel />}
        {activeTab === "history" && (
          <OperationHistoryPanel
            roomId={roomId}
            active={activeTab === "history"}
            currentRevision={currentRevision}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Zoom Controls ─────────────────────────────────────────── */

function ZoomControls() {
  const scale = useWhiteboardStore((state) => state.viewport.scale)
  const zoomViewportBy = useWhiteboardStore((state) => state.zoomViewportBy)
  const canZoomOut = scale > minViewportScale + viewportScaleEpsilon
  const canZoomIn = scale < maxViewportScale - viewportScaleEpsilon

  return (
    <div
      className="shadow-toolbar absolute bottom-4 left-4 flex items-center gap-1 rounded-lg bg-card/95 px-1.5 py-1.5 backdrop-blur"
      aria-label="Zoom controls"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => zoomViewportBy(1 / viewportZoomStep)}
            disabled={!canZoomOut}
            aria-label="Zoom out"
            className={cn(
              "flex size-6 items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-30",
            )}
          >
            <MinusIcon className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Zoom out
        </TooltipContent>
      </Tooltip>

      <span className="min-w-10 text-center font-mono text-xs text-muted-foreground select-none">
        {Math.round(scale * 100)}%
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => zoomViewportBy(viewportZoomStep)}
            disabled={!canZoomIn}
            aria-label="Zoom in"
            className={cn(
              "flex size-6 items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-30",
            )}
          >
            <PlusIcon className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Zoom in
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/* ─── Presence Avatar ───────────────────────────────────────── */

function PresenceAvatar({
  user,
}: {
  user: { name: string; avatarColor?: string | null }
}) {
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "U"

  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold uppercase"
      style={{
        backgroundColor: user.avatarColor ?? "#6B6B65",
        color: "#FFFFFF",
      }}
      aria-hidden="true"
      title={user.name}
    >
      {initials}
    </span>
  )
}

/* ─── Copy Room Link Button ─────────────────────────────────── */

function CopyRoomLinkButton({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard errors
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={handleCopy}
          aria-label="Copy room link"
        >
          <ClipboardCopyIcon className="size-3.5" aria-hidden="true" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        Copy room link to clipboard
      </TooltipContent>
    </Tooltip>
  )
}

/* ─── Toast Viewport ────────────────────────────────────────── */

function WhiteboardToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: WhiteboardToast[]
  onDismiss: (toastId: string) => void
}) {
  useEffect(() => {
    const timeouts = toasts.map((toast) => {
      const delay = Math.max(
        0,
        toast.createdAt + toastAutoDismissMs - Date.now(),
      )
      return window.setTimeout(() => onDismiss(toast.id), delay)
    })

    return () => {
      timeouts.forEach(window.clearTimeout)
    }
  }, [onDismiss, toasts])

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute right-4 bottom-4 z-20 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex min-h-11 items-start gap-3 rounded-xl border px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm",
            toast.variant === "error"
              ? "border-destructive/30 bg-card/95 text-destructive"
              : "border-emerald-300/40 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/90 dark:text-emerald-200",
          )}
        >
          <p className="min-w-0 flex-1 leading-relaxed">{toast.message}</p>
          <button
            type="button"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md opacity-60 transition hover:bg-black/5 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title="Dismiss"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ─── Status helpers ────────────────────────────────────────── */

function StatusMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-card/95 px-3 py-2 text-xs text-destructive shadow-sm backdrop-blur-sm">
      {message}
    </div>
  )
}

function StatusOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm">
        <span
          className="presence-pulse size-2 rounded-full bg-muted-foreground/50"
          aria-hidden="true"
        />
        {message}
      </div>
    </div>
  )
}

function formatConnectionStatus(status: string): string {
  switch (status) {
    case "connecting":
      return "Connecting"
    case "connected":
      return "Live"
    case "reconnecting":
      return "Reconnecting"
    case "disconnected":
      return "Offline"
    default:
      return "Idle"
  }
}

function isEditTool(tool: Tool): boolean {
  return (
    tool === "RECTANGLE" ||
    tool === "CIRCLE" ||
    tool === "LINE" ||
    tool === "TEXT" ||
    tool === "ICON"
  )
}
