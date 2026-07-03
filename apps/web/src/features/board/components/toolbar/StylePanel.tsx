"use client"

import { useCallback, useMemo, useState } from "react"
import { ColorPicker } from "./ColorPicker"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import type { ShapeStyle } from "@rctw/shared-contracts"

// ─── Sub-Component ─────────────────────────────────────────────────────────────

interface StyleSliderProps {
  id?: string
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (val: number) => void
  formatValue?: (val: number) => string | number
}

function StyleSlider({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
}: StyleSliderProps) {
  const [localVal, setLocalVal] = useState(value)
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setLocalVal(value)
    setPrevValue(value)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(parseFloat(e.target.value))
  }

  const handleCommit = () => {
    if (localVal !== value) {
      onChange(localVal)
    }
  }

  const displayVal = formatValue ? formatValue(localVal) : localVal

  return (
    <div className="style-row style-row--col">
      <span className="style-label">{label}</span>
      <div className="style-slider-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          className="style-slider"
          value={localVal}
          onChange={handleInputChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          onKeyUp={handleCommit}
          aria-label={label}
        />
        <span className="style-slider-val">{displayVal}</span>
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Style panel that appears when one or more objects are selected.
 *
 * Positioned adjacent to the Toolbar (below it on the left side).
 * Sections rendered conditionally based on selected object types:
 *   - Fill color
 *   - Stroke color + width slider
 *   - Opacity slider
 *   - Font size + weight (TEXT only)
 *   - Arrow type (LINE only)
 *
 * All changes are applied optimistically to the board store.
 * Socket emission is wired in Plan 08.
 */
interface StylePanelProps {
  updateObject: (objectId: string, patch: { style: Partial<ShapeStyle> }) => void
}

export function StylePanel({ updateObject }: StylePanelProps) {
  const selectedIds = useUIStore((s) => s.selectedIds)
  const objects = useBoardStore((s) => s.objects)

  const selectedObjects = useMemo(
    () => [...selectedIds].map((id) => objects.get(id)).filter(Boolean),
    [selectedIds, objects],
  ) as NonNullable<ReturnType<typeof objects.get>>[]

  // ── Apply style patch to all selected objects ────────────────────────────
  // Must be declared before any early return to satisfy React's rules of hooks.
  const applyStyle = useCallback(
    (patch: Partial<ShapeStyle>) => {
      const currentObjects = useBoardStore.getState().objects
      for (const id of useUIStore.getState().selectedIds) {
        const obj = currentObjects.get(id)
        if (!obj) continue
        updateObject(id, {
          style: { ...obj.style, ...patch },
        })
      }
    },
    [updateObject],
  )

  if (selectedObjects.length === 0) return null

  // Derived values — safe here because they're not hooks
  const firstStyle = selectedObjects[0]!.style
  const allText = selectedObjects.every((o) => o.type === "TEXT")
  const allLine = selectedObjects.every((o) => o.type === "LINE")

  return (
    <div id="style-panel" className="style-panel" aria-label="Style options">
      {/* ── Fill ── */}
      {!allLine && (
        <div className="style-row">
          <ColorPicker
            label="Fill"
            value={firstStyle.fill ?? "#ffffff"}
            onChange={(c) => applyStyle({ fill: c })}
          />
        </div>
      )}

      {/* ── Stroke ── */}
      <div className="style-row">
        <ColorPicker
          label="Stroke"
          value={firstStyle.stroke ?? "#6366f1"}
          onChange={(c) => applyStyle({ stroke: c })}
        />
      </div>

      {/* ── Stroke width ── */}
      <StyleSlider
        id="stroke-width-slider"
        label="Width"
        min={0}
        max={20}
        step={0.5}
        value={firstStyle.strokeWidth ?? 2}
        onChange={(val) => applyStyle({ strokeWidth: val })}
      />

      {/* ── Opacity ── */}
      <StyleSlider
        id="opacity-slider"
        label="Opacity"
        min={0}
        max={1}
        step={0.05}
        value={firstStyle.opacity ?? 1}
        onChange={(val) => applyStyle({ opacity: val })}
        formatValue={(val) => `${Math.round(val * 100)}%`}
      />

      {/* ── TEXT-only: font controls ── */}
      {allText && (
        <>
          <div className="style-sep" aria-hidden />

          <StyleSlider
            id="font-size-slider"
            label="Font size"
            min={8}
            max={96}
            step={1}
            value={firstStyle.fontSize ?? 16}
            onChange={(val) => applyStyle({ fontSize: val })}
            formatValue={(val) => `${val}px`}
          />

          <div className="style-row">
            <span className="style-label">Weight</span>
            <div className="style-toggle-group">
              {(["normal", "bold"] as const).map((w) => (
                <button
                  key={w}
                  className={`style-toggle${(firstStyle.fontWeight ?? "normal") === w ? " style-toggle--active" : ""}`}
                  onClick={() => applyStyle({ fontWeight: w })}
                  aria-pressed={(firstStyle.fontWeight ?? "normal") === w}
                >
                  {w === "bold" ? "B" : "N"}
                </button>
              ))}
            </div>
          </div>

          <div className="style-row">
            <ColorPicker
              label="Color"
              value={firstStyle.color ?? "#1f2937"}
              onChange={(c) => applyStyle({ color: c })}
            />
          </div>
        </>
      )}

      {/* ── LINE-only: arrow type ── */}
      {allLine && (
        <>
          <div className="style-sep" aria-hidden />
          <div className="style-row">
            <span className="style-label">Arrows</span>
            <div className="style-toggle-group">
              <button
                className={`style-toggle${firstStyle.arrowStart ? " style-toggle--active" : ""}`}
                onClick={() =>
                  applyStyle({ arrowStart: !firstStyle.arrowStart })
                }
                aria-pressed={!!firstStyle.arrowStart}
                title="Arrow at start"
              >
                ←
              </button>
              <button
                className={`style-toggle${firstStyle.arrowEnd !== false ? " style-toggle--active" : ""}`}
                onClick={() =>
                  applyStyle({ arrowEnd: !firstStyle.arrowEnd })
                }
                aria-pressed={firstStyle.arrowEnd !== false}
                title="Arrow at end"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
