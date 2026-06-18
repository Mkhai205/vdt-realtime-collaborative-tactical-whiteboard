import { type BoardRole } from "@rctw/shared-contracts"

export function canEditRoom(role: BoardRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR"
}
