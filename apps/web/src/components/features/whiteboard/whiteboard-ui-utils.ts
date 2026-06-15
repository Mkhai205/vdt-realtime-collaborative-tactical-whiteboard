import { useEffect, useState } from "react"
import { withAlpha } from "@/lib/color-utils"

// Re-export shared utilities for backward compatibility within this feature
export {
  isHexColor,
  normalizeHexColor,
  toColorInputValue,
  withAlpha,
  readableForegroundColor,
} from "@/lib/color-utils"
export { isEditableEventTarget } from "@/lib/dom-utils"
export { canEditRoom } from "@/lib/room-utils"

export type CanvasThemeColors = {
  background: string
  minorGrid: string
  majorGrid: string
  foreground: string
  primary: string
  accent: string
}

export const fallbackCanvasColors: CanvasThemeColors = {
  background: "#f7f7f1",
  minorGrid: "rgba(212, 218, 205, 0.58)",
  majorGrid: "rgba(63, 125, 81, 0.5)",
  foreground: "#172018",
  primary: "#14532d",
  accent: "#533707",
}

export function useCanvasThemeColors(): CanvasThemeColors {
  const [colors, setColors] = useState<CanvasThemeColors>(fallbackCanvasColors)

  useEffect(() => {
    function updateColors() {
      const styles = getComputedStyle(document.documentElement)
      const background = styles.getPropertyValue("--background").trim()
      const foreground = styles.getPropertyValue("--foreground").trim()
      const primary = styles.getPropertyValue("--primary").trim()
      const accent = styles.getPropertyValue("--accent-foreground").trim()
      const border = styles.getPropertyValue("--border").trim()
      const ring = styles.getPropertyValue("--ring").trim()

      setColors({
        background: background || fallbackCanvasColors.background,
        minorGrid: withAlpha(border, 0.58) || fallbackCanvasColors.minorGrid,
        majorGrid: withAlpha(ring, 0.5) || fallbackCanvasColors.majorGrid,
        foreground: foreground || fallbackCanvasColors.foreground,
        primary: primary || fallbackCanvasColors.primary,
        accent: accent || fallbackCanvasColors.accent,
      })
    }

    updateColors()

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", updateColors)

    return () => {
      media.removeEventListener("change", updateColors)
    }
  }, [])

  return colors
}

