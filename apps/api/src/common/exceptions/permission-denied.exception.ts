import { HttpStatus } from "@nestjs/common"
import { DomainException } from "./domain.exception"

export class PermissionDeniedException extends DomainException {
  constructor(message = "You do not have permission to perform this action.") {
    super("PERMISSION_DENIED", message, HttpStatus.FORBIDDEN)
  }
}
