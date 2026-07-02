"use client"

import { useCallback, useMemo } from "react"
import { ColorPicker } from "./ColorPicker"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import type { ShapeStyle } from "@rctw/shared-contracts"

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
export function StylePanel() {
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
        useBoardStore.getState().upsertObject({
          ...obj,
          style: { ...obj.style, ...patch },
        })
      }
    },
    // No deps needed — reads from store directly at call time
    [],
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
      <div className="style-row style-row--col">
        <span className="style-label">Width</span>
        <div className="style-slider-row">
          <input
            id="stroke-width-slider"
            type="range"
            min={0}
            max={20}
            step={0.5}
            className="style-slider"
            value={firstStyle.strokeWidth ?? 2}
            onChange={(e) =>
              applyStyle({ strokeWidth: parseFloat(e.target.value) })
            }
            aria-label="Stroke width"
          />
          <span className="style-slider-val">
            {firstStyle.strokeWidth ?? 2}
          </span>
        </div>
      </div>

      {/* ── Opacity ── */}
      <div className="style-row style-row--col">
        <span className="style-label">Opacity</span>
        <div className="style-slider-row">
          <input
            id="opacity-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            className="style-slider"
            value={firstStyle.opacity ?? 1}
            onChange={(e) =>
              applyStyle({ opacity: parseFloat(e.target.value) })
            }
            aria-label="Opacity"
          />
          <span className="style-slider-val">
            {Math.round((firstStyle.opacity ?? 1) * 100)}%
          </span>
        </div>
      </div>

      {/* ── TEXT-only: font controls ── */}
      {allText && (
        <>
          <div className="style-sep" aria-hidden />

          <div className="style-row style-row--col">
            <span className="style-label">Font size</span>
            <div className="style-slider-row">
              <input
                id="font-size-slider"
                type="range"
                min={8}
                max={96}
                step={1}
                className="style-slider"
                value={firstStyle.fontSize ?? 16}
                onChange={(e) =>
                  applyStyle({ fontSize: parseInt(e.target.value, 10) })
                }
                aria-label="Font size"
              />
              <span className="style-slider-val">
                {firstStyle.fontSize ?? 16}px
              </span>
            </div>
          </div>

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
