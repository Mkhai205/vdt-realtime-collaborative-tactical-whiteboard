"use client"

import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  ArrowRight,
  Slash,
  Pencil,
  Highlighter,
  Smile,
  Type,
  Image as ImageIcon,
  Pin,
  Diamond,
  Triangle,
  Hexagon,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import type { Tool } from "@rctw/shared-contracts"
import { useTool } from "@/features/board/hooks/useTool"
import { ToolButton } from "./ToolButton"
import { useRef, useEffect } from "react"
import { boardApi } from "@/features/board/api/board.api"
import { useObjectMutations } from "@/features/board/hooks/useObjectMutations"
import { DEFAULT_STYLES } from "../canvas/objects/shapeDefaults"

// ─── Tool definitions ───────────────────────────────────────────────────────────

const TOOL_GROUPS: Array<
  Array<{
    tool: Tool | "HIGHLIGHTER" | "ARROW" | "LASER"
    icon: LucideIcon
    shortcut: string
    label: string
  }>
> = [
  [
    { tool: "SELECT", icon: MousePointer2, shortcut: "V", label: "Select" },
    { tool: "HAND", icon: Hand, shortcut: "H", label: "Hand" },
  ],
  [
    { tool: "RECTANGLE", icon: Square, shortcut: "R", label: "Rectangle" },
    { tool: "CIRCLE", icon: Circle, shortcut: "C", label: "Circle" },
    { tool: "DIAMOND", icon: Diamond, shortcut: "O", label: "Diamond" },
    { tool: "TRIANGLE", icon: Triangle, shortcut: "Y", label: "Triangle" },
    { tool: "POLYGON", icon: Hexagon, shortcut: "G", label: "Polygon" },
    { tool: "LINE", icon: Slash, shortcut: "L", label: "Line" },
    { tool: "ARROW", icon: ArrowRight, shortcut: "A", label: "Arrow" },
  ],
  [
    { tool: "PATH", icon: Pencil, shortcut: "P", label: "Pen" },
    { tool: "HIGHLIGHTER", icon: Highlighter, shortcut: "D", label: "Highlighter" },
    { tool: "ICON", icon: Smile, shortcut: "I", label: "Icon" },
    { tool: "TEXT", icon: Type, shortcut: "T", label: "Text" },
    { tool: "IMAGE", icon: ImageIcon, shortcut: "U", label: "Image" },
  ],
  [
    { tool: "LASER", icon: Zap, shortcut: "K", label: "Laser Pointer" },
  ],
]

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Floating vertical toolbar — left side of the canvas.
 *
 * Design: glassmorphism card, grouped tools with separators.
 * Active tool is highlighted with a violet background.
 * All tool shortcuts are registered globally via `useTool`.
 */
export function Toolbar() {
  const { activeTool, selectTool } = useTool()
  const boardId = useBoardStore((s) => s.boardId)
  const effectiveRole = useBoardStore((s) => s.effectiveRole)
  const isViewer = effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const mutations = useObjectMutations(boardId || "")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (activeTool === "IMAGE" && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [activeTool])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    selectTool("SELECT")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (!file || !boardId) return

    try {
      const result = await boardApi.uploadImage(boardId, file)

      const img = new window.Image()
      img.src = result.url
      img.onload = () => {
        let w = img.naturalWidth || 200
        let h = img.naturalHeight || 200

        const maxDim = 400
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = (maxDim / w) * h
            w = maxDim
          } else {
            w = (maxDim / h) * w
            h = maxDim
          }
        }

        const viewport = useUIStore.getState().viewport
        const centerX = (window.innerWidth / 2 - viewport.x) / viewport.scale
        const centerY = (window.innerHeight / 2 - viewport.y) / viewport.scale
        const x = centerX - w / 2
        const y = centerY - h / 2

        const preferredStyle = useUIStore.getState().toolStyles["IMAGE"] || DEFAULT_STYLES["IMAGE"]
        const style = {
          ...preferredStyle,
          assetUrl: result.url,
        }

        mutations.createObject({
          type: "IMAGE",
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          style,
          zIndex: useBoardStore.getState().objects.size,
        })
      }
    } catch (error) {
      console.error("Failed to upload image:", error)
    }
  }

  const displayedGroups = isViewer ? [TOOL_GROUPS[0]!] : TOOL_GROUPS

  return (
    <nav
      id="canvas-toolbar"
      className="toolbar"
      role="toolbar"
      aria-label="Drawing tools"
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />
      {displayedGroups.map((group, gi) => (
        <div key={gi} className="toolbar-group">
          {group.map(({ tool, icon: Icon, shortcut, label }) => (
            <ToolButton
              key={tool}
              tool={tool}
              Icon={Icon}
              shortcut={shortcut}
              label={label}
              isActive={activeTool === tool}
              onClick={selectTool}
            />
          ))}
          {gi < displayedGroups.length - 1 && (
            <div className="toolbar-sep" aria-hidden />
          )}
        </div>
      ))}
      {!isViewer && (
        <>
          <div className="toolbar-sep" aria-hidden />
          <div className="toolbar-group">
            <KeepActiveToggle />
          </div>
        </>
      )}
    </nav>
  )
}

function KeepActiveToggle() {
  const keepToolActive = useUIStore((s) => s.keepToolActive)
  const setKeepToolActive = useUIStore((s) => s.setKeepToolActive)

  return (
    <div className="tool-btn-wrapper" role="none">
      <button
        id="tool-btn-keep-active"
        className={`tool-btn${keepToolActive ? " tool-btn--active" : ""}`}
        onClick={() => setKeepToolActive(!keepToolActive)}
        aria-label="Keep selected tool active"
        aria-pressed={keepToolActive}
      >
        <Pin size={18} strokeWidth={keepToolActive ? 2.2 : 1.8} />
      </button>
      <div className="tool-tooltip" role="tooltip">
        <span className="tool-tooltip-label">
          {keepToolActive ? "Lock Tool: Active" : "Lock Tool: Inactive"}
        </span>
      </div>
    </div>
  )
}

