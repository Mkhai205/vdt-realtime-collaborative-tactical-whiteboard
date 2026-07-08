"use client"

import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  ArrowRight,
  Pencil,
  Highlighter,
  Smile,
  Type,
  Image as ImageIcon,
  Pin,
  Diamond,
  Triangle,
  Hexagon,
  MoreHorizontal,
  type LucideIcon,
  Minus,
  Brush,
} from "lucide-react"
import { useBoardStore } from "@/stores/board.store"
import { useUIStore } from "@/stores/ui.store"
import type { Tool } from "@rctw/shared-contracts"
import { useTool } from "@/features/board/hooks/useTool"
import { ToolButton } from "./ToolButton"
import { useRef, useEffect, useState } from "react"
import { boardApi } from "@/features/board/api/board.api"
import { useObjectMutations } from "@/features/board/hooks/useObjectMutations"
import { DEFAULT_STYLES } from "../canvas/objects/shapeDefaults"

// ─── Tool definitions ───────────────────────────────────────────────────────────

const MAIN_GROUPS: Array<
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
    { tool: "LINE", icon: Minus, shortcut: "L", label: "Line" },
    { tool: "TEXT", icon: Type, shortcut: "T", label: "Text" },
    { tool: "ARROW", icon: ArrowRight, shortcut: "A", label: "Arrow" },
    { tool: "PATH", icon: Pencil, shortcut: "P", label: "Pen" },
    {
      tool: "HIGHLIGHTER",
      icon: Highlighter,
      shortcut: "D",
      label: "Highlighter",
    },
    { tool: "LASER", icon: Brush, shortcut: "K", label: "Laser Pointer" },
  ],
]

const MORE_TOOLS: Array<{
  tool: Tool
  icon: LucideIcon
  shortcut: string
  label: string
}> = [
  { tool: "DIAMOND", icon: Diamond, shortcut: "O", label: "Diamond" },
  { tool: "TRIANGLE", icon: Triangle, shortcut: "Y", label: "Triangle" },
  { tool: "POLYGON", icon: Hexagon, shortcut: "G", label: "Polygon" },
  { tool: "ICON", icon: Smile, shortcut: "I", label: "Icon" },
  { tool: "IMAGE", icon: ImageIcon, shortcut: "U", label: "Image" },
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
  const isViewer =
    effectiveRole === "VIEWER" || effectiveRole === "PUBLIC_VIEWER"

  const mutations = useObjectMutations(boardId || "")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (activeTool === "IMAGE" && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [activeTool])

  // Handle click outside to close the More popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false)
      }
    }
    if (isMoreOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isMoreOpen])

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

        const preferredStyle =
          useUIStore.getState().toolStyles["IMAGE"] || DEFAULT_STYLES["IMAGE"]
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

  const displayedGroups = isViewer ? [MAIN_GROUPS[0]!] : MAIN_GROUPS

  const activeMoreTool = MORE_TOOLS.find((t) => t.tool === activeTool)
  const isMoreActive = !!activeMoreTool

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
          {/* Append More button to the main tools group (gi === 1) if not a viewer */}
          {gi === 1 && !isViewer && (
            <div className="tool-btn-wrapper" ref={moreRef}>
              <button
                className={`tool-btn${isMoreActive ? "tool-btn--active" : ""}${isMoreOpen ? "tool-btn--open" : ""}`}
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                aria-label="More drawing tools"
                style={{ position: "relative" }}
              >
                <MoreHorizontal size={18} />
                {isMoreActive && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      right: "4px",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "oklch(0.50 0.19 280)",
                      border: "1.5px solid white",
                      display: "block",
                    }}
                  />
                )}
              </button>
              <div className="tool-tooltip" role="tooltip">
                <span className="tool-tooltip-label">
                  {activeMoreTool
                    ? `More: ${activeMoreTool.label}`
                    : "More Tools"}
                </span>
              </div>

              {isMoreOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--popover-bg, oklch(1 0 0 / 95%))",
                    border: "1px solid oklch(0 0 0 / 7%)",
                    borderRadius: "12px",
                    padding: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    minWidth: "172px",
                    zIndex: 200,
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    boxShadow:
                      "0 8px 32px oklch(0 0 0 / 16%), 0 2px 8px oklch(0 0 0 / 10%)",
                  }}
                >
                  {MORE_TOOLS.map(({ tool, icon: Icon, shortcut, label }) => {
                    const isActive = activeTool === tool
                    return (
                      <button
                        key={tool}
                        onClick={() => {
                          selectTool(tool)
                          setIsMoreOpen(false)
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "none",
                          background: isActive
                            ? "oklch(0.50 0.19 280)"
                            : "transparent",
                          color: isActive ? "oklch(1 0 0)" : "inherit",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: isActive ? 500 : 400,
                          transition: "background 0.12s ease, color 0.12s ease",
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            ;(
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "oklch(0.92 0.008 260)"
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            ;(
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "transparent"
                          }
                        }}
                      >
                        <Icon size={18} style={{ flexShrink: 0 }} />
                        <span style={{ flexGrow: 1 }}>{label}</span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: isActive
                              ? "oklch(0.85 0 0)"
                              : "oklch(0.6 0.01 220)",
                            background: isActive
                              ? "oklch(0.55 0.19 280)"
                              : "oklch(0.96 0.005 260)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            border: "1px solid oklch(0 0 0 / 5%)",
                            flexShrink: 0,
                          }}
                        >
                          {shortcut}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
        className={`tool-btn${keepToolActive ? "tool-btn--active" : ""}`}
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
