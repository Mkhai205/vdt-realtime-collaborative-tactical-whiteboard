/**
 * Shared color utility functions.
 * Centralized from whiteboard-ui-utils, remote-cursor-layer, remote-selection-layer, online-users-panel.
 */

export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function normalizeHexColor(value: string): string {
  const trimmedValue = value.trim()

  if (!isHexColor(trimmedValue)) {
    return "#000000"
  }

  const hex = trimmedValue.slice(1)

  if (hex.length === 6) {
    return `#${hex.toLowerCase()}`
  }

  return `#${hex
    .split("")
    .map((character) => character + character)
    .join("")
    .toLowerCase()}`
}

export function toColorInputValue(value: string | undefined, fallback: string): string {
  if (!value || !isHexColor(value)) {
    return normalizeHexColor(fallback)
  }

  return normalizeHexColor(value)
}

export function withAlpha(color: string, alpha: number): string {
  const trimmedColor = color.trim()

  if (!trimmedColor.startsWith("#")) {
    return trimmedColor
  }

  const hex = trimmedColor.slice(1)
  const normalizedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex

  if (normalizedHex.length !== 6) {
    return trimmedColor
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return trimmedColor
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function readableForegroundColor(bgColor: string, fallback = "#000000"): string {
  const trimmed = bgColor.trim()
  if (!isHexColor(trimmed)) {
    return fallback
  }
  const normalized = normalizeHexColor(trimmed)
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return fallback
  }

  // YIQ formula
  const yiq = (red * 299 + green * 587 + blue * 114) / 1000
  return yiq >= 128 ? "#000000" : "#ffffff"
}
