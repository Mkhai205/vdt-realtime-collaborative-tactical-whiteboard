"use client"

import { useEffect, useState, memo } from "react"
import { Image as KonvaImage, Group, Rect, Text } from "react-konva"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { resolveStyle } from "./shapeDefaults"
import { ICON_REGISTRY } from "./iconRegistry"
import { EditingBadge } from "./EditingBadge"
import { getAvatarColor } from "@/lib/utils"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface IconObjectProps {
  object: BoardObjectDto
  isSelected: boolean
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

const EDIT_LOCK_STROKE = "#3b82f6"
const FALLBACK_SIZE = 48

// ─── SVG → HTMLImageElement helper ─────────────────────────────────────────────

/**
 * Convert a coloured SVG string to an HTMLImageElement for Konva.
 * The colour injection replaces lucide's default `currentColor`.
 */
function svgStringToImage(
  svgStr: string,
  color: string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Replace currentColor with the desired fill colour
    // Replace width/height with 100% to make the SVG responsive on canvas
    const coloured = svgStr
      .replace(/currentColor/g, color)
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, 'height="100%"')

    const blob = new Blob([coloured], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

// ─── Hook: load icon ───────────────────────────────────────────────────────────

/** Cache of cacheKey → resolved HTMLImageElement (module-level, persists across renders) */
const iconImageCache = new Map<string, HTMLImageElement>()

function useIconImage(
  iconKey: string,
  color: string,
): HTMLImageElement | null {
  const cacheKey = `${iconKey}::${color}`

  // A plain counter is all we need to trigger a re-render after an async load.
  // The image itself is read directly from the module-level cache at render time
  // (a pure Map lookup — no side effect, no setState in an effect).
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    // Cache hit: nothing to do — the render below will read it directly.
    if (iconImageCache.has(cacheKey)) return

    let cancelled = false

    ;(async () => {
      try {
        const IconComponent = ICON_REGISTRY[iconKey] || ICON_REGISTRY.Circle
        if (!IconComponent) return

        const { renderToStaticMarkup } = await import("react-dom/server")
        const { createElement } = await import("react")

        // Render at default size, it will be replaced by 100% in svgStringToImage
        const svgStr = renderToStaticMarkup(
          createElement(IconComponent, {
            size: 24,
          }),
        )

        if (cancelled) return
        const loaded = await svgStringToImage(svgStr, color)
        if (cancelled) return

        iconImageCache.set(cacheKey, loaded)
        // setState called asynchronously (inside a Promise chain) — React-19 compliant.
        forceUpdate((n) => n + 1)
      } catch {
        // Silently fall back to the placeholder rendered in JSX
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cacheKey, iconKey, color])

  // Read directly from cache during render — pure, no side effects.
  return iconImageCache.get(cacheKey) ?? null
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders an ICON board object.
 *
 * Uses Lucide icons rendered into an HTMLImageElement via custom SVG path logic,
 * then drawn on canvas using `react-konva.Image`.
 */
export const IconObject = memo(function IconObject({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: IconObjectProps) {
  const s = resolveStyle("ICON", object.style)
  const w = object.width ?? FALLBACK_SIZE
  const h = object.height ?? FALLBACK_SIZE
  const iconSize = Math.min(w, h)

  // Suppress unused — isSelected kept in props for future use (e.g. text highlight)
  void isSelected

  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const activeTool = useUIStore((s) => s.activeTool)
  const isSpacePressed = useUIStore((s) => s.isSpacePressed)
  const isSelectTool = activeTool === "SELECT" && !isSpacePressed

  const img = useIconImage(s.iconKey || "Smile", s.fill)

  const isEditedByOther = !!editingUser
  const borderStroke = editingUser ? getAvatarColor(editingUser.id) : EDIT_LOCK_STROKE
  const borderFill = editingUser ? `${getAvatarColor(editingUser.id)}14` : "rgba(59,130,246,0.08)"
  const badgeWidth = editingUser ? Math.max(editingUser.name.length * 7 + 12, 45) : 0

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      opacity={s.opacity}
      draggable={!isEditedByOther && !isViewer && isSelectTool}
      onClick={(e) => onSelect(object.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(object.id, e.evt.shiftKey)}
      onDragStart={() => onDragStart(object.id)}
      onDragMove={(e) => onDragMove(object.id, e.target.x(), e.target.y(), e)}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {img ? (
        <KonvaImage
          image={img}
          width={iconSize}
          height={iconSize}
          // Center within bounding box
          x={(w - iconSize) / 2}
          y={(h - iconSize) / 2}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      ) : (
        /* Placeholder while loading */
        <>
          <Rect
            width={w}
            height={h}
            fill="#ede9fe"
            cornerRadius={4}
            perfectDrawEnabled={false}
          />
          <Text
            text="?"
            x={0}
            y={0}
            width={w}
            height={h}
            align="center"
            verticalAlign="middle"
            fontSize={Math.max(14, iconSize * 0.4)}
            fill="#6366f1"
            listening={false}
            perfectDrawEnabled={false}
          />
        </>
      )}

      {/* Edit-lock border */}
      {isEditedByOther && (
        <>
          <Rect
            width={w}
            height={h}
            stroke={borderStroke}
            strokeWidth={2}
            fill={borderFill}
            dash={[6, 4]}
            cornerRadius={4}
            listening={false}
            perfectDrawEnabled={false}
          />
          <EditingBadge
            x={Math.max(0, w - badgeWidth)}
            y={-20}
            name={editingUser.name}
            color={borderStroke}
          />
        </>
      )}
    </Group>
  )
})
