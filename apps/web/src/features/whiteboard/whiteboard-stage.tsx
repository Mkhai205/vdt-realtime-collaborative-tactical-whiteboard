"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Layer, Line, Rect, Stage } from "react-konva"
import { getVisibleWorldRect, type WorldRect } from "@/lib/canvas-utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { WhiteboardObjectLayer } from "./whiteboard-object-layer"

const smallGridStep = 32
const majorGridStep = 160

type GridLine = {
  id: string
  points: [number, number, number, number]
}

type CanvasThemeColors = {
  background: string
  minorGrid: string
  majorGrid: string
  foreground: string
  primary: string
  accent: string
}

const fallbackCanvasColors: CanvasThemeColors = {
  background: "#f7f7f1",
  minorGrid: "rgba(212, 218, 205, 0.58)",
  majorGrid: "rgba(63, 125, 81, 0.5)",
  foreground: "#172018",
  primary: "#14532d",
  accent: "#533707",
}

export function WhiteboardStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewport = useWhiteboardStore((state) => state.viewport)
  const stageSize = useWhiteboardStore((state) => state.stageSize)
  const setStageSize = useWhiteboardStore((state) => state.setStageSize)
  const colors = useCanvasThemeColors()

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const containerElement = container

    function updateStageSize() {
      const rect = containerElement.getBoundingClientRect()

      setStageSize({
        width: rect.width,
        height: rect.height,
      })
    }

    updateStageSize()

    const observer = new ResizeObserver(updateStageSize)
    observer.observe(containerElement)

    return () => {
      observer.disconnect()
    }
  }, [setStageSize])

  const visibleWorldRect = useMemo(
    () => getVisibleWorldRect(viewport, stageSize),
    [stageSize, viewport],
  )
  const gridLines = useMemo(
    () => buildGridLines(visibleWorldRect),
    [visibleWorldRect],
  )

  return (
    <div ref={containerRef} className="h-full min-h-[24rem] w-full">
      <Stage
        width={Math.max(1, stageSize.width)}
        height={Math.max(1, stageSize.height)}
      >
        <Layer
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          <Rect
            x={visibleWorldRect.x}
            y={visibleWorldRect.y}
            width={visibleWorldRect.width}
            height={visibleWorldRect.height}
            fill={colors.background}
            listening={false}
          />
          {gridLines.minor.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={colors.minorGrid}
              strokeWidth={1 / viewport.scale}
              listening={false}
            />
          ))}
          {gridLines.major.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={colors.majorGrid}
              strokeWidth={1.5 / viewport.scale}
              listening={false}
            />
          ))}
          <WhiteboardObjectLayer
            defaultColors={{
              foreground: colors.foreground,
              primary: colors.primary,
              accent: colors.accent,
            }}
          />
        </Layer>
      </Stage>
    </div>
  )
}

function buildGridLines(visibleWorldRect: WorldRect): {
  minor: GridLine[]
  major: GridLine[]
} {
  const paddedRect = padWorldRect(visibleWorldRect, majorGridStep)
  const minor: GridLine[] = []
  const major: GridLine[] = []

  for (
    let x = alignToStep(paddedRect.x, smallGridStep);
    x <= paddedRect.x + paddedRect.width;
    x += smallGridStep
  ) {
    const target = isMajorLine(x) ? major : minor

    target.push({
      id: `v-${x}`,
      points: [x, paddedRect.y, x, paddedRect.y + paddedRect.height],
    })
  }

  for (
    let y = alignToStep(paddedRect.y, smallGridStep);
    y <= paddedRect.y + paddedRect.height;
    y += smallGridStep
  ) {
    const target = isMajorLine(y) ? major : minor

    target.push({
      id: `h-${y}`,
      points: [paddedRect.x, y, paddedRect.x + paddedRect.width, y],
    })
  }

  return { minor, major }
}

function padWorldRect(rect: WorldRect, padding: number): WorldRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function alignToStep(value: number, step: number): number {
  return Math.floor(value / step) * step
}

function isMajorLine(value: number): boolean {
  return Math.abs(value % majorGridStep) < 0.001
}

function useCanvasThemeColors(): CanvasThemeColors {
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

function withAlpha(color: string, alpha: number): string {
  const trimmedColor = color.trim()

  if (!trimmedColor.startsWith("#")) {
    return trimmedColor
  }

  const hex = trimmedColor.slice(1)
  const normalizedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex

  if (normalizedHex.length !== 6) {
    return trimmedColor
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return trimmedColor
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
