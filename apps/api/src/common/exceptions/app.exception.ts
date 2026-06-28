import { HttpException, HttpStatus } from "@nestjs/common"
import { ErrorCode, ErrorCodes, ValidationError } from "@rctw/shared-contracts"

export class AppException extends HttpException {
  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    errors?: ValidationError[],
  ) {
    super(
      {
        code,
        message,
        errors,
      },
      statusCode,
    )
  }

  static unauthenticated(message = "Unauthenticated") {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHENTICATED,
      message,
    )
  }

  static userNotFound(message = "User not found") {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCodes.USER_NOT_FOUND,
      message,
    )
  }

  static permissionDenied(message = "Permission denied") {
    return new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCodes.PERMISSION_DENIED,
      message,
    )
  }

  static validationError(
    message = "Validation error",
    errors?: ValidationError[],
  ) {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
      message,
      errors,
    )
  }

  static boardNotFound(message = "Board not found") {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCodes.BOARD_NOT_FOUND,
      message,
    )
  }

  static objectNotFound(message = "Object not found") {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCodes.OBJECT_NOT_FOUND,
      message,
    )
  }

  static objectAlreadyDeleted(message = "Object already deleted") {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCodes.OBJECT_ALREADY_DELETED,
      message,
    )
  }

  static objectVersionConflict(message = "Object version conflict") {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCodes.OBJECT_VERSION_CONFLICT,
      message,
    )
  }

  static duplicateOperation(message = "Duplicate operation") {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCodes.DUPLICATE_OPERATION,
      message,
    )
  }

  static invalidOperationPayload(message = "Invalid operation payload") {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCodes.INVALID_OPERATION_PAYLOAD,
      message,
    )
  }

  static memberNotFound(message = "Member not found") {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCodes.MEMBER_NOT_FOUND,
      message,
    )
  }

  static objectLocked(message = "Object is locked") {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCodes.OBJECT_LOCKED,
      message,
    )
  }
}
