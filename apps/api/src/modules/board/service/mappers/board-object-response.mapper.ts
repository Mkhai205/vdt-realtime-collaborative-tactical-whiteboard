import type { Prisma } from "@rctw/database"
import type { BoardObjectDto } from "@rctw/shared-contracts"

/** Type-safe Prisma BoardObject row (full default selection) */
export type PrismaBoardObject = Prisma.BoardObjectGetPayload<
  Record<string, never>
>

export function toBoardObjectDto(obj: PrismaBoardObject): BoardObjectDto {
  return {
    id: obj.id,
    boardId: obj.boardId,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width ?? null,
    height: obj.height ?? null,
    points: obj.points ?? null,
    text: obj.text ?? null,
    rotation: obj.rotation,
    style: (obj.style ?? {}) as BoardObjectDto["style"],
    zIndex: obj.zIndex,
    version: obj.version,
    createdById: obj.createdById,
    updatedById: obj.updatedById ?? null,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
  }
}
