"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import type { Tool } from "@rctw/shared-contracts"
import {
  CircleIcon,
  HandIcon,
  type LucideIcon,
  MinusIcon,
  MousePointer2Icon,
  MoveRightIcon,
  PlusIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  maxViewportScale,
  minViewportScale,
  viewportZoomStep,
} from "@/lib/canvas-utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { joinRoom } from "../rooms/room-api"
import { ObjectDetailPanel } from "./object-detail-panel"
import {
  getRoomObjects,
  getWhiteboardApiErrorMessage,
} from "./whiteboard-api"

const WhiteboardStage = dynamic(
  () => import("./whiteboard-stage").then((module) => module.WhiteboardStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[24rem] items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        Preparing canvas
      </div>
    ),
  },
)

const toolbarItems = [
  { value: "SELECT", label: "Select", icon: MousePointer2Icon },
  { value: "RECTANGLE", label: "Rectangle", icon: SquareIcon },
  { value: "CIRCLE", label: "Circle", icon: CircleIcon },
  { value: "LINE", label: "Line", icon: MoveRightIcon },
  { value: "TEXT", label: "Text", icon: TypeIcon },
  { value: "HAND", label: "Hand", icon: HandIcon },
] as const satisfies ReadonlyArray<{
  value: Tool
  label: string
  icon: LucideIcon
}>

const viewportScaleEpsilon = 0.001
type LoadState = "loading" | "ready" | "error"

export function WhiteboardPage({ roomId }: { roomId: string }) {
  const setRoomId = useWhiteboardStore((state) => state.setRoomId)
  const setLoadedRoomState = useWhiteboardStore(
    (state) => state.setLoadedRoomState,
  )
  const room = useWhiteboardStore((state) => state.room)
  const currentUser = useWhiteboardStore((state) => state.currentUser)
  const currentRevision = useWhiteboardStore((state) => state.currentRevision)
  const mutationError = useWhiteboardStore((state) => state.mutationError)
  const currentTool = useWhiteboardStore((state) => state.currentTool)
  const viewport = useWhiteboardStore((state) => state.viewport)
  const stageSize = useWhiteboardStore((state) => state.stageSize)
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let isCurrent = true

    async function loadWhiteboardState() {
      setLoadState("loading")
      setLoadError("")

      try {
        setRoomId(roomId)

        const joinResponse = await joinRoom(roomId)
        const objectsResponse = await getRoomObjects(roomId)

        if (!isCurrent) {
          return
        }

        setLoadedRoomState({
          room: joinResponse.room,
          currentUser: joinResponse.currentUser,
          currentRevision: objectsResponse.currentRevision,
          objects: objectsResponse.objects,
        })
        setLoadState("ready")
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setLoadError(getWhiteboardApiErrorMessage(error))
        setLoadState("error")
      }
    }

    void loadWhiteboardState()

    return () => {
      isCurrent = false
    }
  }, [roomId, setLoadedRoomState, setRoomId])

  useEffect(() => {
    setRoomId(roomId)
  }, [roomId, setRoomId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        isEditableEventTarget(event.target)
      ) {
        return
      }

      const selectedObjectId = useWhiteboardStore.getState().selectedObjectId
      const role = useWhiteboardStore.getState().currentUser?.role

      if (!selectedObjectId || !canEditRole(role)) {
        return
      }

      event.preventDefault()
      deleteSelectedObject()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [deleteSelectedObject])

  return (
    <main className="flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Whiteboard</Badge>
            <Badge variant="outline">
              {loadState === "loading"
                ? "Loading"
                : loadState === "error"
                  ? "Error"
                  : "Ready"}
            </Badge>
            {currentUser ? <Badge variant="outline">{currentUser.role}</Badge> : null}
            <Badge variant="outline">{currentTool}</Badge>
          </div>
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-lg leading-tight font-semibold">
              {room?.name ?? "Tactical room"}
            </h1>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {roomId}
            </p>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground md:flex">
          <span>
            {stageSize.width}x{stageSize.height}
          </span>
          <span aria-hidden="true">/</span>
          <span>{Math.round(viewport.scale * 100)}%</span>
          <span aria-hidden="true">/</span>
          <span>rev {currentRevision}</span>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[3.5rem_minmax(0,1fr)_20rem] lg:overflow-hidden">
        <ToolPalette />

        <section
          className="relative min-h-[24rem] overflow-hidden rounded-lg border bg-background shadow-sm lg:min-h-0"
          aria-label="Whiteboard canvas"
        >
          <WhiteboardStage />
          <ZoomControls />
          {loadState === "loading" ? (
            <StatusOverlay message="Loading room objects" />
          ) : null}
          {loadState === "error" ? <StatusOverlay message={loadError} /> : null}
          {mutationError ? (
            <div className="absolute top-3 left-3 max-w-md rounded-lg border border-destructive/40 bg-background/95 px-3 py-2 text-sm text-destructive shadow-sm backdrop-blur">
              {mutationError}
            </div>
          ) : null}
        </section>

        <ObjectDetailPanel />
      </section>
    </main>
  )
}

function StatusOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 p-6 text-sm text-muted-foreground backdrop-blur-sm">
      <div className="rounded-lg border bg-background px-4 py-3 shadow-sm">
        {message}
      </div>
    </div>
  )
}

function ZoomControls() {
  const scale = useWhiteboardStore((state) => state.viewport.scale)
  const zoomViewportBy = useWhiteboardStore((state) => state.zoomViewportBy)
  const canZoomOut = scale > minViewportScale + viewportScaleEpsilon
  const canZoomIn = scale < maxViewportScale - viewportScaleEpsilon

  return (
    <div
      className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur"
      aria-label="Zoom controls"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Zoom out"
        aria-label="Zoom out"
        disabled={!canZoomOut}
        onClick={() => zoomViewportBy(1 / viewportZoomStep)}
      >
        <MinusIcon data-icon="inline-start" />
      </Button>
      <span className="min-w-12 text-center font-mono text-xs text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Zoom in"
        aria-label="Zoom in"
        disabled={!canZoomIn}
        onClick={() => zoomViewportBy(viewportZoomStep)}
      >
        <PlusIcon data-icon="inline-start" />
      </Button>
    </div>
  )
}

function ToolPalette() {
  const currentTool = useWhiteboardStore((state) => state.currentTool)
  const selectedObjectId = useWhiteboardStore((state) => state.selectedObjectId)
  const role = useWhiteboardStore((state) => state.currentUser?.role)
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )
  const setTool = useWhiteboardStore((state) => state.setTool)
  const canEdit = canEditRole(role)
  const canDelete = canEdit && Boolean(selectedObjectId)

  return (
    <aside
      className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-sm lg:flex-col"
      aria-label="Whiteboard tools"
    >
      <ToggleGroup
        type="single"
        value={currentTool}
        aria-label="Whiteboard tool"
        className="gap-2 lg:flex-col"
        onValueChange={(value) => {
          if (value) {
            setTool(value as Tool)
          }
        }}
      >
        {toolbarItems.map((item) => {
          const Icon = item.icon

          return (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              title={item.label}
              aria-label={item.label}
              disabled={!canEdit && isEditTool(item.value)}
            >
              <Icon data-icon="inline-start" />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        title="Delete selected object"
        aria-label="Delete selected object"
        disabled={!canDelete}
        onClick={deleteSelectedObject}
      >
        <Trash2Icon data-icon="inline-start" />
      </Button>
    </aside>
  )
}

function canEditRole(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR"
}

function isEditTool(tool: Tool): boolean {
  return tool === "RECTANGLE" || tool === "CIRCLE" || tool === "LINE" || tool === "TEXT"
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()

  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  const role = target.getAttribute("role")

  return role === "textbox" || Boolean(target.closest("[contenteditable=true]"))
}
