"use client"

import { useState, useCallback, useRef, useEffect } from "react"

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#6366f1", // violet
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#1f2937", // dark
  "#ffffff", // white
  "transparent",
]

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  /** Label for the trigger button (e.g. "Fill" or "Stroke") */
  label?: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Compact color picker:
 * - Trigger: small color swatch button
 * - Popover: preset swatches + hex text input
 * - "transparent" option rendered as a hatched swatch
 */
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  // hexInput is only meaningful while the popover is open.
  // It is initialized from `value` when the popover opens (not via an effect).
  const [hexInput, setHexInput] = useState("")
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click — only attached while the popover is open
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleOpen = useCallback(() => {
    // Initialize the hex buffer from the current prop value when opening.
    // This is a click handler, not an effect, so setState is fine here.
    setHexInput(value === "transparent" ? "transparent" : value)
    setOpen((v) => !v)
  }, [value])

  const handlePreset = useCallback(
    (color: string) => {
      onChange(color)
      setHexInput(color)
      setOpen(false)
    },
    [onChange],
  )

  const handleHexCommit = useCallback(() => {
    const trimmed = hexInput.trim()
    if (!trimmed) return
    onChange(trimmed)
  }, [hexInput, onChange])

  const displayColor = value === "transparent" ? "transparent" : value

  return (
    <div className="color-picker-wrapper" ref={popoverRef}>
      {label && <span className="style-label">{label}</span>}

      <button
        className="color-swatch-btn"
        onClick={handleOpen}
        aria-label={`Pick color. Current: ${value}`}
        title={value}
        style={{
          background:
            value === "transparent"
              ? "repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, white 0, white 50%)"
              : displayColor,
        }}
      />

      {open && (
        <div className="color-popover" role="dialog" aria-label="Color picker">
          <div className="color-swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch${value === c ? " color-swatch--active" : ""}`}
                onClick={() => handlePreset(c)}
                aria-label={c}
                title={c}
                style={{
                  background:
                    c === "transparent"
                      ? "repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, white 0, white 50%)"
                      : c,
                }}
              />
            ))}
          </div>

          <div className="color-hex-row">
            <span className="color-hex-hash">#</span>
            <input
              className="color-hex-input"
              value={hexInput.replace(/^#/, "")}
              onChange={(e) => setHexInput(`#${e.target.value}`)}
              onBlur={handleHexCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleHexCommit()
                  setOpen(false)
                }
              }}
              maxLength={7}
              placeholder="6366f1"
              aria-label="Custom hex color"
            />
          </div>
        </div>
      )}
    </div>
  )
}
