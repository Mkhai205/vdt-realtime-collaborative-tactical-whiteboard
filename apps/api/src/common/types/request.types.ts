import type { Request } from "express"
import { JwtPayload } from "../../modules/auth/auth.type"

export type RequestWithCurrentUser = Request & {
  currentUser?: JwtPayload
}
