"use client"

import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  ArrowRight,
  Type,
  Pencil,
  Smile,
  type LucideIcon,
} from "lucide-react"
import type { Tool } from "@rctw/shared-contracts"
import { useTool } from "@/features/board/hooks/useTool"
import { ToolButton } from "./ToolButton"

// ─── Tool definitions ───────────────────────────────────────────────────────────

const TOOL_GROUPS: Array<
  Array<{
    tool: Tool
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
    { tool: "LINE", icon: ArrowRight, shortcut: "L", label: "Line" },
  ],
  [
    { tool: "TEXT", icon: Type, shortcut: "T", label: "Text" },
    { tool: "PATH", icon: Pencil, shortcut: "P", label: "Pen" },
    { tool: "ICON", icon: Smile, shortcut: "I", label: "Icon" },
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

  return (
    <nav
      id="canvas-toolbar"
      className="toolbar"
      role="toolbar"
      aria-label="Drawing tools"
    >
      {TOOL_GROUPS.map((group, gi) => (
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
          {gi < TOOL_GROUPS.length - 1 && (
            <div className="toolbar-sep" aria-hidden />
          )}
        </div>
      ))}
    </nav>
  )
}
