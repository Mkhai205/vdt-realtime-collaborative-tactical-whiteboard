import { HttpStatus } from "@nestjs/common"
import { DomainException } from "./domain.exception"

export class BoardNotFoundException extends DomainException {
  constructor(message = "Board not found.") {
    super("BOARD_NOT_FOUND", message, HttpStatus.NOT_FOUND)
  }
}
