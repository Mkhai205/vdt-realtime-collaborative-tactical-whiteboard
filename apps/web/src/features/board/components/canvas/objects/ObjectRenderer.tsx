import { memo } from "react"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { RectangleObject } from "./RectangleObject"
import { CircleObject } from "./CircleObject"
import { LineObject } from "./LineObject"

import { PathObject } from "./PathObject"
import { IconObject } from "./IconObject"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ObjectRendererProps {
  object: BoardObjectDto
  isSelected: boolean
  /** The user who is currently editing this object, if any */
  editingUser?: UserSummary
  onSelect: (id: string, multi: boolean) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, newX: number, newY: number, e: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTextChange: (id: string, text: string, width?: number, height?: number) => void
  setObjectEditingState?: (objectId: string, status: "STARTED" | "ENDED") => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Dispatcher: maps a `BoardObjectDto.type` to its concrete renderer.
 *
 * Rendering priority (zIndex) is handled by the parent `ObjectsLayer`;
 * each renderer is responsible only for its own visual.
 */
export const ObjectRenderer = memo(function ObjectRenderer({
  object,
  isSelected,
  editingUser,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTextChange,
  setObjectEditingState,
}: ObjectRendererProps) {
  switch (object.type) {
    case "RECTANGLE":
      return (
        <RectangleObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "CIRCLE":
      return (
        <CircleObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "LINE":
      return (
        <LineObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
        />
      )



    case "PATH":
      return (
        <PathObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
        />
      )

    case "ICON":
      return (
        <IconObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    default:
      return null
  }
})
