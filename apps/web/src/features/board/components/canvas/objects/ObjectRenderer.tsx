"use client"

import type { BoardObjectDto } from "@rctw/shared-contracts"
import { RectangleObject } from "./RectangleObject"
import { CircleObject } from "./CircleObject"
import { LineObject } from "./LineObject"
import { TextObject } from "./TextObject"
import { PathObject } from "./PathObject"
import { IconObject } from "./IconObject"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ObjectRendererProps {
  object: BoardObjectDto
  isSelected: boolean
  /** True if this object is currently being edited by another user */
  isEditedByOther: boolean
  onSelect: (id: string, multi: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTextChange: (id: string, text: string) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Dispatcher: maps a `BoardObjectDto.type` to its concrete renderer.
 *
 * Rendering priority (zIndex) is handled by the parent `ObjectsLayer`;
 * each renderer is responsible only for its own visual.
 */
export function ObjectRenderer({
  object,
  isSelected,
  isEditedByOther,
  onSelect,
  onDragEnd,
  onTextChange,
}: ObjectRendererProps) {
  switch (object.type) {
    case "RECTANGLE":
      return (
        <RectangleObject
          object={object}
          isSelected={isSelected}
          isEditedByOther={isEditedByOther}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      )

    case "CIRCLE":
      return (
        <CircleObject
          object={object}
          isSelected={isSelected}
          isEditedByOther={isEditedByOther}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      )

    case "LINE":
      return (
        <LineObject
          object={object}
          isSelected={isSelected}
          isEditedByOther={isEditedByOther}
          onSelect={onSelect}
        />
      )

    case "TEXT":
      return (
        <TextObject
          object={object}
          isSelected={isSelected}
          isEditedByOther={isEditedByOther}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTextChange={onTextChange}
        />
      )

    case "PATH":
      return (
        <PathObject
          object={object}
          isSelected={isSelected}
          isEditedByOther={isEditedByOther}
          onSelect={onSelect}
        />
      )

    case "ICON":
      return (
        <IconObject
          object={object}
          isSelected={isSelected}
          isEditedByOther={isEditedByOther}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      )

    default:
      return null
  }
}
