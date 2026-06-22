import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import { apiErrorCodes, type WhiteboardObject } from "@rctw/shared-contracts"

export function boardNotFound(message = "Board not found.") {
  return new NotFoundException({
    code: apiErrorCodes.BOARD_NOT_FOUND,
    message,
  })
}

export function memberNotFound(message = "Board member not found.") {
  return new NotFoundException({
    code: apiErrorCodes.MEMBER_NOT_FOUND,
    message,
  })
}

export function objectNotFound(message = "Object not found.") {
  return new NotFoundException({
    code: apiErrorCodes.OBJECT_NOT_FOUND,
    message,
  })
}

export function objectAlreadyDeleted(
  message = "Object has already been deleted.",
) {
  return new ConflictException({
    code: apiErrorCodes.OBJECT_ALREADY_DELETED,
    message,
  })
}

export function objectVersionConflict(
  latestObject: WhiteboardObject,
  currentBoardRevision?: number,
  message = "Whiteboard object has changed since your last edit.",
) {
  return new ConflictException({
    code: apiErrorCodes.OBJECT_VERSION_CONFLICT,
    message,
    details: {
      latestObject,
      currentBoardRevision,
    },
  })
}

export function duplicateOperation(
  message = "This client operation has already been processed.",
) {
  return new ConflictException({
    code: apiErrorCodes.DUPLICATE_OPERATION,
    message,
  })
}

export function permissionDenied(
  message = "You do not have permission to perform this action.",
) {
  return new ForbiddenException({
    code: apiErrorCodes.PERMISSION_DENIED,
    message,
  })
}

export function validationError(message: string) {
  return new BadRequestException({
    code: apiErrorCodes.VALIDATION_ERROR,
    message,
  })
}
