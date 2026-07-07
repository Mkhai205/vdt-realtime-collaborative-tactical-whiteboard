import type { ObjectType, ShapeStyle } from "@rctw/shared-contracts"

// ─── Default Styles ────────────────────────────────────────────────────────────

export const DEFAULT_STYLES: Record<ObjectType, Required<ShapeStyle>> = {
  RECTANGLE: {
    fill: "#ffffff",
    stroke: "#6366f1",
    strokeWidth: 2,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#1f2937",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
  CIRCLE: {
    fill: "#ffffff",
    stroke: "#6366f1",
    strokeWidth: 2,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#1f2937",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
  LINE: {
    fill: "transparent",
    stroke: "#374151",
    strokeWidth: 2,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#374151",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
  TEXT: {
    fill: "transparent",
    stroke: "transparent",
    strokeWidth: 0,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#1f2937",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
  PATH: {
    fill: "transparent",
    stroke: "#374151",
    strokeWidth: 3,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#374151",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
  ICON: {
    fill: "#6366f1",
    stroke: "transparent",
    strokeWidth: 0,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#6366f1",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "Smile",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
  IMAGE: {
    fill: "transparent",
    stroke: "transparent",
    strokeWidth: 0,
    opacity: 1,
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    color: "#1f2937",
    arrowStart: false,
    arrowEnd: false,
    iconKey: "",
    assetUrl: "",
    scale: 1,
    label: "",
    textAlign: "left",
  },
}

/** Merge object style with per-type defaults, keeping explicit values. */
export function resolveStyle(
  type: ObjectType,
  style: ShapeStyle,
): Required<ShapeStyle> {
  return { ...DEFAULT_STYLES[type], ...style } as Required<ShapeStyle>
}

// ─── Points Helpers ────────────────────────────────────────────────────────────

/**
 * Safely cast `BoardObjectDto.points` (typed `unknown`) to a flat number[].
 * Returns an empty array if the value isn't a valid flat number array.
 */
export function safePoints(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const nums = raw.filter((v) => typeof v === "number") as number[]
  return nums.length === raw.length ? nums : []
}

// ─── Bounding Box ──────────────────────────────────────────────────────────────

export type Rect = { x: number; y: number; width: number; height: number }

/** Compute bounding rect from a flat [x1,y1,x2,y2,...] points array. */
export function getBoundsFromPoints(points: number[]): Rect {
  if (points.length < 2) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length - 1; i += 2) {
    const x = points[i]!
    const y = points[i + 1]!
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
