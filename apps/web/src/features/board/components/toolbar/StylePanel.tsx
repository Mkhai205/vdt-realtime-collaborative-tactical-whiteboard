"use client"

import { useCallback, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { ColorPicker } from "./ColorPicker"
import { useUIStore } from "@/stores/ui.store"
import { useBoardStore } from "@/stores/board.store"
import type {
  ShapeStyle,
  BoardObjectDto,
  ObjectType,
} from "@rctw/shared-contracts"
import type { UseObjectMutationsReturn } from "../../hooks/useObjectMutations"
import {
  Copy,
  Trash2,
  Link,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
} from "lucide-react"
import { toast } from "sonner"
import { DEFAULT_STYLES } from "../canvas/objects/shapeDefaults"
import { ICON_REGISTRY } from "../canvas/objects/iconRegistry"

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

const DRAWING_TOOLS = new Set([
  "RECTANGLE",
  "CIRCLE",
  "LINE",
  "PATH",
  "ICON",
  "TEXT",
])

export function StylePanel({ mutations }: StylePanelProps) {
  const { updateObject } = mutations
  const selectedIds = useUIStore((s) => s.selectedIds)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const activeTool = useUIStore((s) => s.activeTool)
  const toolStyles = useUIStore((s) => s.toolStyles)
  const setToolStyle = useUIStore((s) => s.setToolStyle)

  // Narrow selector: only triggers re-render when the selected objects themselves change.
  const selectedObjects = useBoardStore(
    useShallow((s) => {
      const list = []
      for (const id of selectedIds) {
        const obj = s.objects.get(id)
        if (obj) {
          list.push(obj)
        }
      }
      return list
    }),
  ) as BoardObjectDto[]

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
    const selected = useUIStore.getState().selectedIds
    if (selected.size === 0) return
    const currentObjects = useBoardStore.getState().objects
    const allObjects = [...currentObjects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const sel = allObjects.filter((o) => selected.has(o.id))
    const nonSelected = allObjects.filter((o) => !selected.has(o.id))

    const newOrder = [...sel, ...nonSelected]
    const originalZIndices = allObjects.map((o) => o.zIndex)

    newOrder.forEach((obj, idx) => {
      const newZ = originalZIndices[idx]!
      if (obj.zIndex !== newZ) {
        updateObject(obj.id, { zIndex: newZ })
      }
    })
  }, [updateObject])

  const handleSendBackward = useCallback(() => {
    const selected = useUIStore.getState().selectedIds
    if (selected.size === 0) return
    const currentObjects = useBoardStore.getState().objects
    const allObjects = [...currentObjects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const nextOrder = [...allObjects]
    for (let i = 1; i < nextOrder.length; i++) {
      const current = nextOrder[i]!
      const prev = nextOrder[i - 1]!
      if (selected.has(current.id) && !selected.has(prev.id)) {
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
  }, [updateObject])

  const handleBringForward = useCallback(() => {
    const selected = useUIStore.getState().selectedIds
    if (selected.size === 0) return
    const currentObjects = useBoardStore.getState().objects
    const allObjects = [...currentObjects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const nextOrder = [...allObjects]
    for (let i = nextOrder.length - 2; i >= 0; i--) {
      const current = nextOrder[i]!
      const next = nextOrder[i + 1]!
      if (selected.has(current.id) && !selected.has(next.id)) {
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
  }, [updateObject])

  const handleBringToFront = useCallback(() => {
    const selected = useUIStore.getState().selectedIds
    if (selected.size === 0) return
    const currentObjects = useBoardStore.getState().objects
    const allObjects = [...currentObjects.values()].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
      return a.createdAt.localeCompare(b.createdAt)
    })

    const sel = allObjects.filter((o) => selected.has(o.id))
    const nonSelected = allObjects.filter((o) => !selected.has(o.id))

    const newOrder = [...nonSelected, ...sel]
    const originalZIndices = allObjects.map((o) => o.zIndex)

    newOrder.forEach((obj, idx) => {
      const newZ = originalZIndices[idx]!
      if (obj.zIndex !== newZ) {
        updateObject(obj.id, { zIndex: newZ })
      }
    })
  }, [updateObject])

  // ── Apply style patch to all selected objects ────────────────────────────
  // Must be declared before any early return to satisfy React's rules of hooks.
  const applyStyle = useCallback(
    (patch: Partial<ShapeStyle>) => {
      const selected = useUIStore.getState().selectedIds
      if (selected.size > 0) {
        const currentObjects = useBoardStore.getState().objects
        for (const id of selected) {
          const obj = currentObjects.get(id)
          if (!obj) continue
          updateObject(id, {
            style: { ...obj.style, ...patch },
          })
        }
      } else {
        const active = useUIStore.getState().activeTool
        setToolStyle(active, patch)
      }
    },
    [updateObject, setToolStyle],
  )

  const isDrawingToolActive = DRAWING_TOOLS.has(activeTool)
  if (selectedObjects.length === 0 && !isDrawingToolActive) return null

  // Derived values — safe here because they're not hooks
  const firstStyle =
    selectedObjects.length > 0
      ? selectedObjects[0]!.style
      : toolStyles[activeTool] ||
        DEFAULT_STYLES[activeTool as ObjectType] ||
        DEFAULT_STYLES.RECTANGLE

  const hasFill =
    selectedObjects.length > 0
      ? selectedObjects.every((o) => o.type !== "LINE" && o.type !== "PATH")
      : activeTool !== "LINE" && activeTool !== "PATH"

  const hasStroke =
    selectedObjects.length > 0
      ? selectedObjects.every((o) => o.type !== "ICON" && o.type !== "TEXT")
      : activeTool !== "ICON" && activeTool !== "TEXT"

  const hasIcon =
    selectedObjects.length > 0
      ? selectedObjects.some((o) => o.type === "ICON")
      : activeTool === "ICON"

  const hasTextSettings =
    selectedObjects.length > 0
      ? selectedObjects.some((o) => o.type === "TEXT")
      : activeTool === "TEXT"

  const allLine =
    selectedObjects.length > 0
      ? selectedObjects.every((o) => o.type === "LINE")
      : activeTool === "LINE"

  const handleSelectIcon = (iconName: string) => {
    applyStyle({ iconKey: iconName })
  }

  return (
    <div id="style-panel" className="style-panel" aria-label="Style options">
      {/* ── Fill ── */}
      {hasFill && (
        <div className="style-row">
          <ColorPicker
            label="Fill"
            value={firstStyle.fill ?? "#ffffff"}
            onChange={(c) => applyStyle({ fill: c })}
          />
        </div>
      )}

      {/* ── Stroke ── */}
      {hasStroke && (
        <>
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
        </>
      )}

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

      {/* ── Typography (TEXT only) ── */}
      {hasTextSettings && (
        <>
          <div className="style-sep" aria-hidden />
          <div className="style-row">
            <ColorPicker
              label="Text Color"
              value={firstStyle.color ?? "#1f2937"}
              onChange={(c) => applyStyle({ color: c })}
            />
          </div>
          <StyleSlider
            id="font-size-slider"
            label="Font Size"
            min={10}
            max={72}
            step={1}
            value={firstStyle.fontSize ?? 16}
            onChange={(val) => applyStyle({ fontSize: val })}
          />
          <div className="style-row">
            <span className="style-label">Style</span>
            <button
              className={`style-toggle ${firstStyle.fontWeight === "bold" ? "style-toggle--active" : ""}`}
              onClick={() =>
                applyStyle({
                  fontWeight: firstStyle.fontWeight === "bold" ? "normal" : "bold",
                })
              }
              aria-pressed={firstStyle.fontWeight === "bold"}
              style={{ fontWeight: "bold", width: "100%" }}
            >
              B
            </button>
          </div>
          <div className="style-row style-row--col">
            <span className="style-label">Font</span>
            <select
              className="style-select"
              value={firstStyle.fontFamily ?? "Inter, sans-serif"}
              onChange={(e) => applyStyle({ fontFamily: e.target.value })}
              style={{
                width: "100%",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "var(--background, #fff)",
                fontSize: "12px",
              }}
            >
              <option value="Inter, sans-serif">Inter</option>
              <option value="system-ui, sans-serif">System</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Courier New, monospace">Courier</option>
            </select>
          </div>
        </>
      )}

      {/* ── Icon Picker (ICON only) ── */}
      {hasIcon && (
        <>
          <div className="style-sep" aria-hidden />
          <div className="style-row style-row--col">
            <span className="style-label">Icon</span>
            <div className="icon-grid">
              {Object.entries(ICON_REGISTRY).map(([name, IconComponent]) => {
                const isActive = firstStyle.iconKey === name
                return (
                  <button
                    key={name}
                    className={`icon-grid-btn${isActive ? "icon-grid-btn--active" : ""}`}
                    onClick={() => handleSelectIcon(name)}
                    title={name}
                    aria-label={`Select ${name} icon`}
                    aria-pressed={isActive}
                  >
                    <IconComponent size={16} />
                  </button>
                )
              })}
            </div>
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
                className={`style-toggle${firstStyle.arrowStart ? "style-toggle--active" : ""}`}
                onClick={() =>
                  applyStyle({ arrowStart: !firstStyle.arrowStart })
                }
                aria-pressed={!!firstStyle.arrowStart}
                title="Arrow at start"
              >
                ←
              </button>
              <button
                className={`style-toggle${firstStyle.arrowEnd !== false ? "style-toggle--active" : ""}`}
                onClick={() => applyStyle({ arrowEnd: !firstStyle.arrowEnd })}
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
      {selectedObjects.length > 0 && (
        <>
          <div className="style-sep" aria-hidden />
          <div className="style-row style-row--col">
            <span className="style-label" style={{ marginBottom: 4 }}>
              Layers
            </span>
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
        </>
      )}

      {/* ── Actions ── */}
      <div className="style-sep" aria-hidden />
      <div className="style-row style-row--col">
        <span className="style-label" style={{ marginBottom: 4 }}>
          Actions
        </span>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {selectedObjects.length > 0 && (
            <>
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
                  transition: "background 0.15s, border-color 0.15s",
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
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}

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
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <Link size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
