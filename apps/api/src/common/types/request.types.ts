import { JwtPayload } from "@rctw/shared-contracts"
import type { Request } from "express"

export type RequestWithCurrentUser = Request & {
  currentUser?: JwtPayload
}
