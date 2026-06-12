import { useEffect, useState, useRef } from "react"
import type { StageSize } from "../whiteboard-helpers"
import { isEditableEventTarget } from "../whiteboard-ui-utils"

export function useStagePanning(
  setStageSize: (size: StageSize) => void,
  clearPanDrag: () => void,
  cancelAllTransformPreviews: () => void,
  endAllLocalEditing: () => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSpacePanning, setIsSpacePanning] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      setStageSize({
        width: rect.width,
        height: rect.height,
      })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [setStageSize])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        isEditableEventTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      setIsSpacePanning(true)
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return
      }

      if (!isEditableEventTarget(event.target)) {
        event.preventDefault()
      }

      setIsSpacePanning(false)
      clearPanDrag()
    }

    function handleWindowBlur() {
      setIsSpacePanning(false)
      clearPanDrag()
      cancelAllTransformPreviews()
      endAllLocalEditing()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleWindowBlur)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleWindowBlur)
    }
  }, [cancelAllTransformPreviews, clearPanDrag, endAllLocalEditing])

  return { isSpacePanning, containerRef, setIsSpacePanning }
}
