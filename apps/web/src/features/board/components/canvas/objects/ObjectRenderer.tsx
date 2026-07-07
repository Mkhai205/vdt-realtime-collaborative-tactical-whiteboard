import { memo } from "react"
import type { BoardObjectDto, UserSummary } from "@rctw/shared-contracts"
import { RectangleObject } from "./RectangleObject"
import { CircleObject } from "./CircleObject"
import { LineObject } from "./LineObject"
import { PathObject } from "./PathObject"
import { IconObject } from "./IconObject"
import { TextObject } from "./TextObject"
import { ImageObject } from "./ImageObject"
import { DiamondObject } from "./DiamondObject"
import { TriangleObject } from "./TriangleObject"
import { PolygonObject } from "./PolygonObject"

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
  onTextChange: _onTextChange,
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
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "PATH":
      return (
        <PathObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
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

    case "TEXT":
      return (
        <TextObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "IMAGE":
      return (
        <ImageObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "DIAMOND":
      return (
        <DiamondObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "TRIANGLE":
      return (
        <TriangleObject
          object={object}
          isSelected={isSelected}
          editingUser={editingUser}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )

    case "POLYGON":
      return (
        <PolygonObject
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
