import { Prisma } from "@rctw/database"
import {
  type ObjectCreateInput,
  type ObjectMutablePatch,
} from "@rctw/shared-contracts"
import {
  toShapeStyle,
  toWhiteboardObject,
  type WhiteboardObjectRecord,
} from "./board-object-response.mapper"

export function toCreateObjectData(
  boardId: string,
  createdById: string,
  input: ObjectCreateInput,
): Prisma.BoardObjectUncheckedCreateInput {
  return {
    boardId,
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width ?? null,
    height: input.height ?? null,
    points: input.points ?? Prisma.DbNull,
    text: input.text ?? null,
    rotation: input.rotation ?? 0,
    style: toJsonValue(input.style ?? {}),
    zIndex: input.zIndex ?? 0,
    version: 1,
    createdById,
  }
}

export function toUpdateObjectData(
  object: WhiteboardObjectRecord,
  patch: ObjectMutablePatch,
  updatedById: string,
): Prisma.BoardObjectUncheckedUpdateManyInput {
  const data: Prisma.BoardObjectUncheckedUpdateManyInput = {
    updatedById,
    version: {
      increment: 1,
    },
  }

  if ("x" in patch) {
    data.x = patch.x
  }

  if ("y" in patch) {
    data.y = patch.y
  }

  if ("width" in patch) {
    data.width = patch.width
  }

  if ("height" in patch) {
    data.height = patch.height
  }

  if ("points" in patch) {
    data.points = patch.points ?? Prisma.DbNull
  }

  if ("text" in patch) {
    data.text = patch.text ?? null
  }

  if ("rotation" in patch) {
    data.rotation = patch.rotation
  }

  if ("style" in patch && patch.style) {
    data.style = toJsonValue({
      ...toShapeStyle(object.style),
      ...patch.style,
    })
  }

  if ("zIndex" in patch) {
    data.zIndex = patch.zIndex
  }

  return data
}

export function getPreviousValues(
  object: WhiteboardObjectRecord,
  patch: ObjectMutablePatch,
): ObjectMutablePatch {
  const previousValues: ObjectMutablePatch = {}

  if ("x" in patch) {
    previousValues.x = object.x
  }

  if ("y" in patch) {
    previousValues.y = object.y
  }

  if ("width" in patch) {
    previousValues.width = object.width ?? undefined
  }

  if ("height" in patch) {
    previousValues.height = object.height ?? undefined
  }

  if ("points" in patch) {
    previousValues.points = toWhiteboardObject(object).points ?? undefined
  }

  if ("text" in patch) {
    previousValues.text = object.text ?? undefined
  }

  if ("rotation" in patch) {
    previousValues.rotation = object.rotation
  }

  if ("style" in patch) {
    previousValues.style = toShapeStyle(object.style)
  }

  if ("zIndex" in patch) {
    previousValues.zIndex = object.zIndex
  }

  return previousValues
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
