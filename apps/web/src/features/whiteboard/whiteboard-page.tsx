"use client"

import dynamic from "next/dynamic"
import { useEffect } from "react"
import {
  CircleIcon,
  HandIcon,
  MousePointer2Icon,
  MoveRightIcon,
  PanelRightIcon,
  SquareIcon,
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
  { label: "Select", icon: MousePointer2Icon },
  { label: "Rectangle", icon: SquareIcon },
  { label: "Circle", icon: CircleIcon },
  { label: "Line", icon: MoveRightIcon },
  { label: "Text", icon: TypeIcon },
  { label: "Hand", icon: HandIcon },
] as const

export function WhiteboardPage({ roomId }: { roomId: string }) {
  const setRoomId = useWhiteboardStore((state) => state.setRoomId)
  const seedDemoObjects = useWhiteboardStore((state) => state.seedDemoObjects)
  const viewport = useWhiteboardStore((state) => state.viewport)
  const stageSize = useWhiteboardStore((state) => state.stageSize)

  useEffect(() => {
    setRoomId(roomId)
    seedDemoObjects(roomId)
  }, [roomId, seedDemoObjects, setRoomId])

  return (
    <main className="flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Whiteboard</Badge>
            <Badge variant="outline">Ready</Badge>
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
        <ToolbarPlaceholder />

        <section
          className="min-h-[24rem] overflow-hidden rounded-lg border bg-background shadow-sm lg:min-h-0"
          aria-label="Whiteboard canvas"
        >
          <WhiteboardStage />
        </section>

        <DetailPanelPlaceholder />
      </section>
    </main>
  )
}

function ToolbarPlaceholder() {
  return (
    <aside
      className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-sm lg:flex-col"
      aria-label="Whiteboard tools"
    >
      {toolbarItems.map((item) => {
        const Icon = item.icon

        return (
          <Button
            key={item.label}
            type="button"
            variant="outline"
            size="icon"
            disabled
            title={item.label}
            aria-label={item.label}
          >
            <Icon data-icon="inline-start" />
          </Button>
        )
      })}
    </aside>
  )
}

function DetailPanelPlaceholder() {
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
      </CardContent>
    </Card>
  )
}
