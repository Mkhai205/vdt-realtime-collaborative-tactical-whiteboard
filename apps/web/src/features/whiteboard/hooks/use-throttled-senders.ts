import { useCallback, useEffect, useRef } from "react"
import type { CanvasPoint } from "../whiteboard-helpers"
import type { ObjectTransformPreviewPatch } from "@rctw/shared-contracts"

const transformPreviewThrottleMs = 50
const cursorUpdateThrottleMs = 50
const cursorMovementEpsilon = 1

function hasCursorMovedEnough(
  previousPoint: CanvasPoint | null,
  nextPoint: CanvasPoint,
): boolean {
  if (!previousPoint) {
    return true
  }

  return (
    Math.hypot(
      nextPoint.x - previousPoint.x,
      nextPoint.y - previousPoint.y,
    ) >= cursorMovementEpsilon
  )
}

export function useThrottledSenders(
  sendCursorUpdate: (point: CanvasPoint) => void,
  sendTransformPreview: (objectId: string, preview: ObjectTransformPreviewPatch) => void,
  sendEditingStart: (objectId: string) => void,
  sendEditingEnd: (objectId: string) => void,
) {
  const activeEditingObjectIdsRef = useRef(new Set<string>())
  const transformPreviewTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  )
  const transformPreviewLastSentAtRef = useRef(new Map<string, number>())
  const transformPreviewPendingRef = useRef(
    new Map<string, ObjectTransformPreviewPatch>(),
  )
  const cursorUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const cursorUpdateLastSentAtRef = useRef(0)
  const cursorUpdatePendingRef = useRef<CanvasPoint | null>(null)
  const cursorUpdateLastPointRef = useRef<CanvasPoint | null>(null)

  const cancelTransformPreview = useCallback((objectId: string) => {
    const timeout = transformPreviewTimersRef.current.get(objectId)

    if (timeout) {
      clearTimeout(timeout)
      transformPreviewTimersRef.current.delete(objectId)
    }

    transformPreviewPendingRef.current.delete(objectId)
  }, [])

  const cancelAllTransformPreviews = useCallback(() => {
    for (const timeout of transformPreviewTimersRef.current.values()) {
      clearTimeout(timeout)
    }

    transformPreviewTimersRef.current.clear()
    transformPreviewPendingRef.current.clear()
  }, [])

  const startLocalEditing = useCallback(
    (objectId: string) => {
      if (activeEditingObjectIdsRef.current.has(objectId)) {
        return
      }

      activeEditingObjectIdsRef.current.add(objectId)
      sendEditingStart(objectId)
    },
    [sendEditingStart],
  )

  const endLocalEditing = useCallback(
    (objectId: string) => {
      if (!activeEditingObjectIdsRef.current.delete(objectId)) {
        return
      }

      sendEditingEnd(objectId)
    },
    [sendEditingEnd],
  )

  const endAllLocalEditing = useCallback(() => {
    for (const objectId of activeEditingObjectIdsRef.current) {
      sendEditingEnd(objectId)
    }

    activeEditingObjectIdsRef.current.clear()
  }, [sendEditingEnd])

  const queueTransformPreview = useCallback(
    (objectId: string, preview: ObjectTransformPreviewPatch) => {
      const now = Date.now()
      const lastSentAt =
        transformPreviewLastSentAtRef.current.get(objectId) ?? 0
      const elapsed = now - lastSentAt

      if (elapsed >= transformPreviewThrottleMs) {
        cancelTransformPreview(objectId)
        transformPreviewLastSentAtRef.current.set(objectId, now)
        sendTransformPreview(objectId, preview)
        return
      }

      transformPreviewPendingRef.current.set(objectId, preview)

      if (transformPreviewTimersRef.current.has(objectId)) {
        return
      }

      const timeout = setTimeout(() => {
        transformPreviewTimersRef.current.delete(objectId)

        const pendingPreview =
          transformPreviewPendingRef.current.get(objectId)

        if (!pendingPreview) {
          return
        }

        transformPreviewPendingRef.current.delete(objectId)
        transformPreviewLastSentAtRef.current.set(objectId, Date.now())
        sendTransformPreview(objectId, pendingPreview)
      }, transformPreviewThrottleMs - elapsed)

      transformPreviewTimersRef.current.set(objectId, timeout)
    },
    [cancelTransformPreview, sendTransformPreview],
  )

  const cancelCursorUpdate = useCallback(() => {
    if (cursorUpdateTimerRef.current) {
      clearTimeout(cursorUpdateTimerRef.current)
      cursorUpdateTimerRef.current = null
    }

    cursorUpdatePendingRef.current = null
  }, [])

  const emitCursorUpdate = useCallback(
    (point: CanvasPoint) => {
      cursorUpdateLastSentAtRef.current = Date.now()
      sendCursorUpdate(point)
    },
    [sendCursorUpdate],
  )

  const queueCursorUpdate = useCallback(
    (point: CanvasPoint) => {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !hasCursorMovedEnough(cursorUpdateLastPointRef.current, point)
      ) {
        return
      }

      cursorUpdateLastPointRef.current = point

      const now = Date.now()
      const elapsed = now - cursorUpdateLastSentAtRef.current

      if (elapsed >= cursorUpdateThrottleMs) {
        cancelCursorUpdate()
        emitCursorUpdate(point)
        return
      }

      cursorUpdatePendingRef.current = point

      if (cursorUpdateTimerRef.current) {
        return
      }

      cursorUpdateTimerRef.current = setTimeout(() => {
        cursorUpdateTimerRef.current = null

        const pendingPoint = cursorUpdatePendingRef.current

        if (!pendingPoint) {
          return
        }

        cursorUpdatePendingRef.current = null
        emitCursorUpdate(pendingPoint)
      }, cursorUpdateThrottleMs - elapsed)
    },
    [cancelCursorUpdate, emitCursorUpdate],
  )

  useEffect(() => {
    return () => {
      cancelAllTransformPreviews()
      endAllLocalEditing()
    }
  }, [cancelAllTransformPreviews, endAllLocalEditing])

  useEffect(() => {
    return () => {
      cancelCursorUpdate()
    }
  }, [cancelCursorUpdate])

  return {
    activeEditingObjectIdsRef,
    startLocalEditing,
    endLocalEditing,
    endAllLocalEditing,
    queueTransformPreview,
    cancelTransformPreview,
    cancelAllTransformPreviews,
    queueCursorUpdate,
    cancelCursorUpdate,
  }
}
