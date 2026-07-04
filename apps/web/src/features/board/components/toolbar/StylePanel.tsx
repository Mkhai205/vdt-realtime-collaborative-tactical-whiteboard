"use client"

import { useCallback, useMemo, useState } from "react"
import { ColorPicker } from "./ColorPicker"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import type { ShapeStyle } from "@rctw/shared-contracts"
import type { UseObjectMutationsReturn } from "../../hooks/useObjectMutations"
import { Copy, Trash2, Link, ArrowDownToLine, ArrowDown, ArrowUp, ArrowUpToLine } from "lucide-react"
import { toast } from "sonner"

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
  mutations: UseObjectMutationsReturn
}

export function StylePanel({ mutations }: StylePanelProps) {
  const { updateObject } = mutations
  const selectedIds = useUIStore((s) => s.selectedIds)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const objects = useBoardStore((s) => s.objects)

  const handleDuplicate = () => {
    const currentObjects = useBoardStore.getState().objects
    for (const id of selectedIds) {
      const src = currentObjects.get(id)
      if (!src) continue

      const payload = {
        type: src.type,
        x: src.x + 20,
        y: src.y + 20,
        width: src.width ?? undefined,
        height: src.height ?? undefined,
        points: src.points ?? undefined,
        text: src.text ?? undefined,
        rotation: src.rotation,
        style: src.style,
        zIndex: currentObjects.size,
      }
      mutations.createObject(payload, "add")
    }
  }

  const handleDelete = () => {
    for (const id of selectedIds) {
      mutations.deleteObject(id)
    }
    clearSelection()
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success("Board link copied to clipboard!")
  }

  const handleSendToBack = useCallback(() => {
    if (selectedIds.size === 0) return
    const allObjects = [...objects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const selected = allObjects.filter((o) => selectedIds.has(o.id))
    const nonSelected = allObjects.filter((o) => !selectedIds.has(o.id))

    const newOrder = [...selected, ...nonSelected]
    const originalZIndices = allObjects.map((o) => o.zIndex)

    newOrder.forEach((obj, idx) => {
      const newZ = originalZIndices[idx]!
      if (obj.zIndex !== newZ) {
        updateObject(obj.id, { zIndex: newZ })
      }
    })
  }, [selectedIds, objects, updateObject])

  const handleSendBackward = useCallback(() => {
    if (selectedIds.size === 0) return
    const allObjects = [...objects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const nextOrder = [...allObjects]
    for (let i = 1; i < nextOrder.length; i++) {
      const current = nextOrder[i]!
      const prev = nextOrder[i - 1]!
      if (selectedIds.has(current.id) && !selectedIds.has(prev.id)) {
        nextOrder[i] = prev
        nextOrder[i - 1] = current
      }
    }

    const originalZIndices = allObjects.map((o) => o.zIndex)

    nextOrder.forEach((obj, idx) => {
      const newZ = originalZIndices[idx]!
      if (obj.zIndex !== newZ) {
        updateObject(obj.id, { zIndex: newZ })
      }
    })
  }, [selectedIds, objects, updateObject])

  const handleBringForward = useCallback(() => {
    if (selectedIds.size === 0) return
    const allObjects = [...objects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const nextOrder = [...allObjects]
    for (let i = nextOrder.length - 2; i >= 0; i--) {
      const current = nextOrder[i]!
      const next = nextOrder[i + 1]!
      if (selectedIds.has(current.id) && !selectedIds.has(next.id)) {
        nextOrder[i] = next
        nextOrder[i + 1] = current
      }
    }

    const originalZIndices = allObjects.map((o) => o.zIndex)

    nextOrder.forEach((obj, idx) => {
      const newZ = originalZIndices[idx]!
      if (obj.zIndex !== newZ) {
        updateObject(obj.id, { zIndex: newZ })
      }
    })
  }, [selectedIds, objects, updateObject])

  const handleBringToFront = useCallback(() => {
    if (selectedIds.size === 0) return
    const allObjects = [...objects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const selected = allObjects.filter((o) => selectedIds.has(o.id))
    const nonSelected = allObjects.filter((o) => !selectedIds.has(o.id))

    const newOrder = [...nonSelected, ...selected]
    const originalZIndices = allObjects.map((o) => o.zIndex)

    newOrder.forEach((obj, idx) => {
      const newZ = originalZIndices[idx]!
      if (obj.zIndex !== newZ) {
        updateObject(obj.id, { zIndex: newZ })
      }
    })
  }, [selectedIds, objects, updateObject])

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

      {/* ── Layers ── */}
      <div className="style-sep" aria-hidden />
      <div className="style-row style-row--col">
        <span className="style-label" style={{ marginBottom: 4 }}>Layers</span>
        <div className="style-toggle-group">
          <button
            className="style-toggle"
            onClick={handleSendToBack}
            title="Send to back"
            aria-label="Send to back"
          >
            <ArrowDownToLine size={14} />
          </button>
          <button
            className="style-toggle"
            onClick={handleSendBackward}
            title="Send backward"
            aria-label="Send backward"
          >
            <ArrowDown size={14} />
          </button>
          <button
            className="style-toggle"
            onClick={handleBringForward}
            title="Bring forward"
            aria-label="Bring forward"
          >
            <ArrowUp size={14} />
          </button>
          <button
            className="style-toggle"
            onClick={handleBringToFront}
            title="Bring to front"
            aria-label="Bring to front"
          >
            <ArrowUpToLine size={14} />
          </button>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="style-sep" aria-hidden />
      <div className="style-row style-row--col">
        <span className="style-label" style={{ marginBottom: 4 }}>Actions</span>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {/* Duplicate button */}
          <button
            onClick={handleDuplicate}
            title="Duplicate (Ctrl+D)"
            style={{
              width: 32,
              height: 32,
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6366f1",
              transition: "background 0.15s, border-color 0.15s"
            }}
          >
            <Copy size={16} />
          </button>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            title="Delete (Delete)"
            style={{
              width: 32,
              height: 32,
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444",
              transition: "background 0.15s, border-color 0.15s"
            }}
          >
            <Trash2 size={16} />
          </button>

          {/* Link button */}
          <button
            onClick={handleCopyLink}
            title="Copy board link"
            style={{
              width: 32,
              height: 32,
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6366f1",
              transition: "background 0.15s, border-color 0.15s"
            }}
          >
            <Link size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
