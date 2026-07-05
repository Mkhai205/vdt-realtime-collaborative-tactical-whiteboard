"use client"

import type { LucideIcon } from "lucide-react"
import type { Tool } from "@rctw/shared-contracts"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ToolButtonProps {
  tool: Tool
  Icon: LucideIcon
  shortcut: string
  label: string
  isActive: boolean
  onClick: (tool: Tool) => void
  disabled?: boolean
  disabledTooltip?: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Individual tool button inside the floating Toolbar.
 *
 * - Active state: violet background with white icon
 * - Hover state: subtle background lift
 * - Shows tooltip (label + shortcut badge) on hover
 * - Keyboard shortcut displayed in a small badge inside the tooltip
 */
export function ToolButton({
  tool,
  Icon,
  shortcut,
  label,
  isActive,
  onClick,
  disabled = false,
  disabledTooltip,
}: ToolButtonProps) {
  return (
    <div className="tool-btn-wrapper" role="none">
      <button
        id={`tool-btn-${tool.toLowerCase()}`}
        className={`tool-btn${isActive ? " tool-btn--active" : ""}`}
        onClick={() => !disabled && onClick(tool)}
        aria-label={`${label} (${shortcut})`}
        aria-pressed={isActive}
        disabled={disabled}
        style={{
          opacity: disabled ? 0.4 : undefined,
          cursor: disabled ? "not-allowed" : undefined,
        }}
      >
        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
      </button>
      <div className="tool-tooltip" role="tooltip">
        <span className="tool-tooltip-label">
          {disabled && disabledTooltip ? disabledTooltip : label}
        </span>
        {!disabled && <kbd className="tool-tooltip-key">{shortcut}</kbd>}
      </div>
    </div>
  )
}

