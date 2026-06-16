import { HttpException, HttpStatus } from "@nestjs/common"
import type { ApiErrorCode } from "@rctw/shared-contracts"

/**
 * Base domain exception that carries a typed error code.
 * All domain-specific exceptions should extend this class.
 */
export class DomainException extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status)
  }
}
