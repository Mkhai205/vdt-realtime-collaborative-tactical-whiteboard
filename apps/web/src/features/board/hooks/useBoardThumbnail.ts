"use client"

import { useEffect, useRef, useCallback } from "react"
import { useBoardStore } from "@/stores/board.store"
import { boardApi } from "@/features/board/api/board.api"
import Konva from "konva"

/**
 * Hook to automatically capture a thumbnail of the Konva stage when the user leaves the board.
 * It crops the canvas to fit all elements in 320x180, uploads it to MinIO, and updates the board info.
 */
export function useBoardThumbnail(
  boardId: string,
  stageRef: React.RefObject<Konva.Stage | null>
) {
  const revision = useBoardStore((s) => s.revision)
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isEditor = effectiveRole === "OWNER" || effectiveRole === "EDITOR"

  // Keep track of the revision we last captured/started with
  const lastCapturedRevisionRef = useRef<number>(0)

  const captureAndUpload = useCallback(async () => {
    if (!isEditor) return
    const stage = stageRef.current
    if (!stage) return

    // If there were no revision changes, skip uploading
    if (revision <= lastCapturedRevisionRef.current) return

    // Find the objects layer to check if we have any elements
    const objectsLayer = stage.findOne("#objects-layer") as Konva.Layer | undefined
    if (!objectsLayer) return

    const children = objectsLayer.getChildren().filter((c) => c.id() !== "lasso-rect")
    if (children.length === 0) return

    // Calculate bounding box in world space
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const child of children) {
      const rect = child.getClientRect({ relativeTo: objectsLayer })
      minX = Math.min(minX, rect.x)
      minY = Math.min(minY, rect.y)
      maxX = Math.max(maxX, rect.x + rect.width)
      maxY = Math.max(maxY, rect.y + rect.height)
    }

    // Guard if coordinates are invalid
    if (minX === Infinity || minY === Infinity) return

    const PADDING = 20
    const contentW = maxX - minX + PADDING * 2
    const contentH = maxY - minY + PADDING * 2

    const thumbWidth = 320
    const thumbHeight = 180

    // Scale to fit 320x180
    const scale = Math.min(thumbWidth / contentW, thumbHeight / contentH)
    const targetScale = Math.max(0.01, scale)

    const targetX = (thumbWidth - contentW * targetScale) / 2 - (minX - PADDING) * targetScale
    const targetY = (thumbHeight - contentH * targetScale) / 2 - (minY - PADDING) * targetScale

    // Save original viewport state
    const originalScale = stage.scale()
    const originalPos = stage.position()
    const originalSize = { width: stage.width(), height: stage.height() }

    // Hide selection layer temporarily to avoid rendering selection boxes in thumbnail
    const selectionLayer = stage.findOne("#selection-layer") as Konva.Layer | undefined
    if (selectionLayer) selectionLayer.visible(false)

    // Add a temporary white background rect that covers the entire exported stage viewport
    const bgRect = new Konva.Rect({
      x: -targetX / targetScale,
      y: -targetY / targetScale,
      width: thumbWidth / targetScale,
      height: thumbHeight / targetScale,
      fill: "#ffffff",
      listening: false,
    })
    objectsLayer.add(bgRect)
    bgRect.moveToBottom()

    // Reconfigure stage for thumbnail dimensions
    stage.width(thumbWidth)
    stage.height(thumbHeight)
    stage.scale({ x: targetScale, y: targetScale })
    stage.position({ x: targetX, y: targetY })

    // Redraw
    stage.draw()

    // Export to Data URL
    const dataUrl = stage.toDataURL({
      mimeType: "image/jpeg",
      quality: 0.8,
    })

    // Remove the temporary white background rect
    bgRect.destroy()

    // Restore original viewport state
    stage.width(originalSize.width)
    stage.height(originalSize.height)
    stage.scale(originalScale)
    stage.position(originalPos)
    if (selectionLayer) selectionLayer.visible(true)
    stage.draw()

    // Mark as updated to prevent concurrent/redundant updates
    lastCapturedRevisionRef.current = revision

    try {
      // Convert data URL to File
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `thumbnail-${boardId}.jpg`, { type: "image/jpeg" })

      // Upload to storage
      const uploadResult = await boardApi.uploadImage(boardId, file)

      // Save to board metadata
      await boardApi.updateBoardInfo(boardId, { thumbnailUrl: uploadResult.url })
      console.log("[Thumbnail] Updated board thumbnail url to white background:", uploadResult.url)
    } catch (err) {
      console.error("[Thumbnail] Failed to capture/upload board thumbnail:", err)
      // Reset last captured ref on failure so it can retry later
      lastCapturedRevisionRef.current = 0
    }
  }, [boardId, isEditor, revision, stageRef])

  // Track initial revision when user enters
  useEffect(() => {
    lastCapturedRevisionRef.current = revision
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-capture on component unmount (leaving board)
  useEffect(() => {
    return () => {
      captureAndUpload()
    }
  }, [captureAndUpload])

  // Handle window unload / reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      captureAndUpload()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [captureAndUpload])

  return { captureAndUpload }
}
