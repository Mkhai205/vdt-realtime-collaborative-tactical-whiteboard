import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import type { WhiteboardObject } from "@rctw/shared-contracts"

export function roomNotFound() {
  return new NotFoundException({
    code: "ROOM_NOT_FOUND",
    message: "Room not found.",
  })
}

export function objectNotFound() {
  return new NotFoundException({
    code: "OBJECT_NOT_FOUND",
    message: "Whiteboard object not found.",
  })
}

export function objectAlreadyDeleted() {
  return new ConflictException({
    code: "OBJECT_ALREADY_DELETED",
    message: "Whiteboard object has already been deleted.",
  })
}

export function objectVersionConflict(
  latestObject: WhiteboardObject,
  currentRoomRevision?: number,
) {
  return new ConflictException({
    code: "OBJECT_VERSION_CONFLICT",
    message: "Whiteboard object has changed since your last edit.",
    details: {
      latestObject,
      currentRoomRevision,
    },
  })
}

export function duplicateOperation() {
  return new ConflictException({
    code: "DUPLICATE_OPERATION",
    message: "This client operation has already been processed.",
  })
}

export function permissionDenied(message: string) {
  return new ForbiddenException({
    code: "PERMISSION_DENIED",
    message,
  })
}
