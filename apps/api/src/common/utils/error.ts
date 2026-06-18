import { UnauthorizedException } from "@nestjs/common"
import { apiErrorCodes } from "@rctw/shared-contracts"

export function unauthenticated(message = "Unauthenticated.") {
  return new UnauthorizedException({
    code: apiErrorCodes.UNAUTHENTICATED,
    message,
  })
}

export function userNotFound(message = "User not found.") {
  return new UnauthorizedException({
    code: apiErrorCodes.USER_NOT_FOUND,
    message,
  })
}
