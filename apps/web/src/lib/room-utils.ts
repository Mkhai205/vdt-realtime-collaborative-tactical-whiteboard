import { type RoomRole, canEditRoomRole } from "@rctw/shared-contracts"

export function canEditRoom(role: RoomRole | null | undefined): boolean {
  if (!role) {
    return false
  }
  return canEditRoomRole(role)
}
