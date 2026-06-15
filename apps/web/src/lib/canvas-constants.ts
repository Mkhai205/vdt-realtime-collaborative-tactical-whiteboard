/**
 * Centralized shape dimension and grid constants.
 * Single source of truth — previously duplicated across whiteboard-helpers,
 * whiteboard-shape-renderer, and remote-selection-layer.
 */

export type LinePoints = [number, number, number, number]

// Grid spacing
export const smallGridStep = 32
export const majorGridStep = 160

// Default shape dimensions
export const defaultRectangleWidth = 160
export const defaultRectangleHeight = 96
export const defaultCircleSize = 128
export const defaultTextWidth = 220
export const defaultTextHeight = 72
export const defaultLinePoints: LinePoints = [0, 0, 160, 0]

// Constraints
export const minimumObjectSize = 16
export const minimumFontSize = 8
export const minimumStrokeWidth = 0
export const minLineLength = 8
export const minObjectTransformSize = 16
export const minLineTransformLength = 8
export const canvasValuePrecision = 100

// Demo/fallback IDs
export const demoActorId = "00000000-0000-4000-8000-000000000401"
export const localFallbackActorId = "00000000-0000-4000-8000-000000000402"
export const demoTimestamp = "2026-06-06T00:00:00.000Z"
