"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { OperationSummary } from "@rctw/shared-contracts"
import { HistoryIcon, RefreshCwIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  getRoomOperations,
  getWhiteboardApiErrorMessage,
} from "./whiteboard-api"
import {
  formatObjectType,
  formatOperationObjectId,
  formatOperationTimestamp,
  formatOperationType,
} from "./operation-history-formatting"

type LoadState = "idle" | "loading" | "ready" | "error"

const operationHistoryLimit = 50

export function OperationHistoryPanel({
  roomId,
  active,
  currentRevision,
}: {
  roomId: string
  active: boolean
  currentRevision: number
}) {
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [operations, setOperations] = useState<OperationSummary[]>([])
  const [error, setError] = useState("")
  const lastLoadedRevisionRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const isMountedRef = useRef(false)
  const isLoading = loadState === "loading"

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadOperations = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoadState("loading")
    setError("")

    try {
      const response = await getRoomOperations(roomId, operationHistoryLimit)

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setOperations(response.operations)
      lastLoadedRevisionRef.current = currentRevision
      setLoadState("ready")
    } catch (loadError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setError(getWhiteboardApiErrorMessage(loadError))
      setLoadState("error")
    }
  }, [currentRevision, roomId])

  useEffect(() => {
    if (!active || isLoading) {
      return
    }

    if (
      loadState === "idle" ||
      lastLoadedRevisionRef.current !== currentRevision
    ) {
      void loadOperations()
    }
  }, [active, currentRevision, isLoading, loadOperations, loadState])

  return (
    <Card className="min-h-0 flex-1 shadow-sm" size="sm">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon data-icon="inline-start" />
            History
          </CardTitle>
          <Badge variant="secondary">{operations.length}</Badge>
        </div>
        <CardDescription>
          {isLoading && operations.length > 0
            ? "Refreshing latest operations"
            : `Latest ${operationHistoryLimit} operations`}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        {loadState === "loading" && operations.length === 0 ? (
          <HistoryStatus message="Loading history" />
        ) : null}

        {loadState === "error" ? <HistoryStatus message={error} error /> : null}

        {loadState === "ready" && operations.length === 0 ? (
          <HistoryStatus message="No operations recorded yet." />
        ) : null}

        {operations.length > 0 ? (
          <ul className="flex flex-col gap-2 pb-1" aria-label="Operation history">
            {operations.map((operation) => (
              <OperationHistoryRow
                key={operation.id}
                operation={operation}
              />
            ))}
          </ul>
        ) : null}
      </CardContent>

      <CardFooter className="shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isLoading}
          onClick={() => void loadOperations()}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  )
}

function OperationHistoryRow({
  operation,
}: {
  operation: OperationSummary
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge variant="outline">rev {operation.revision}</Badge>
        <Badge variant={operationBadgeVariant(operation.type)}>
          {formatOperationType(operation.type)}
        </Badge>
        <Badge variant="secondary">{formatObjectType(operation.objectType)}</Badge>
      </div>

      <p className="text-sm leading-snug font-medium">{operation.summary}</p>

      <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <HistoryMeta label="Actor" value={operation.actor.name} />
        <HistoryMeta
          label="Time"
          value={formatOperationTimestamp(operation.createdAt)}
        />
        <HistoryMeta
          label="Object"
          value={formatOperationObjectId(operation.objectId)}
          mono
        />
      </div>
    </li>
  )
}

function HistoryMeta({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <span>{label}</span>
      <span className={mono ? "truncate font-mono" : "truncate"} title={value}>
        {value}
      </span>
    </>
  )
}

function HistoryStatus({
  message,
  error = false,
}: {
  message: string
  error?: boolean
}) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-4 text-sm",
        error
          ? "border-destructive/40 bg-background text-destructive"
          : "border-dashed bg-muted/40 text-muted-foreground",
      )}
    >
      {message}
    </p>
  )
}

function operationBadgeVariant(
  type: OperationSummary["type"],
): "default" | "outline" | "secondary" | "destructive" {
  switch (type) {
    case "OBJECT_CREATE":
      return "default"
    case "OBJECT_UPDATE":
      return "secondary"
    case "OBJECT_DELETE":
      return "destructive"
    case "OBJECT_RESTORE":
      return "outline"
  }
}
