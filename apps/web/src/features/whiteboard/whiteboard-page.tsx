"use client"

import dynamic from "next/dynamic"
import { useEffect } from "react"
import type { Tool } from "@rctw/shared-contracts"
import {
  CircleIcon,
  HandIcon,
  type LucideIcon,
  MinusIcon,
  MousePointer2Icon,
  MoveRightIcon,
  PanelRightIcon,
  PlusIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  maxViewportScale,
  minViewportScale,
  viewportZoomStep,
} from "@/lib/canvas-utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"

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

export function WhiteboardPage({ roomId }: { roomId: string }) {
  const setRoomId = useWhiteboardStore((state) => state.setRoomId)
  const seedDemoObjects = useWhiteboardStore((state) => state.seedDemoObjects)
  const currentTool = useWhiteboardStore((state) => state.currentTool)
  const viewport = useWhiteboardStore((state) => state.viewport)
  const stageSize = useWhiteboardStore((state) => state.stageSize)
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )

  useEffect(() => {
    setRoomId(roomId)
    seedDemoObjects(roomId)
  }, [roomId, seedDemoObjects, setRoomId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        isEditableEventTarget(event.target)
      ) {
        return
      }

      const selectedObjectId = useWhiteboardStore.getState().selectedObjectId

      if (!selectedObjectId) {
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
            <Badge variant="outline">Ready</Badge>
            <Badge variant="outline">{currentTool}</Badge>
          </div>
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-lg leading-tight font-semibold">
              Tactical room
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
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[3.5rem_minmax(0,1fr)_20rem]">
        <ToolPalette />

        <section
          className="relative min-h-[24rem] overflow-hidden rounded-lg border bg-background shadow-sm lg:min-h-0"
          aria-label="Whiteboard canvas"
        >
          <WhiteboardStage />
          <ZoomControls />
        </section>

        <DetailPanelPlaceholder />
      </section>
    </main>
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
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )
  const setTool = useWhiteboardStore((state) => state.setTool)
  const canDelete = Boolean(selectedObjectId)

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

function DetailPanelPlaceholder() {
  const selectedObjectId = useWhiteboardStore((state) => state.selectedObjectId)
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )
  const canDelete = Boolean(selectedObjectId)

  return (
    <Card className="min-h-0 shadow-sm" size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PanelRightIcon data-icon="inline-start" />
          Details
        </CardTitle>
        <CardDescription>No object selected</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd className="text-foreground">-</dd>
          <dt className="text-muted-foreground">Position</dt>
          <dd className="font-mono text-xs text-foreground">-</dd>
          <dt className="text-muted-foreground">Size</dt>
          <dd className="font-mono text-xs text-foreground">-</dd>
          <dt className="text-muted-foreground">Rotation</dt>
          <dd className="font-mono text-xs text-foreground">-</dd>
        </dl>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-4 w-full"
          disabled={!canDelete}
          onClick={deleteSelectedObject}
        >
          <Trash2Icon data-icon="inline-start" />
          Delete object
        </Button>
      </CardContent>
    </Card>
  )
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
