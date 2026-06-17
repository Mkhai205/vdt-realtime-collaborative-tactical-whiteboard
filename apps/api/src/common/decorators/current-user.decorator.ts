import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import type { RequestWithCurrentUser } from "../types/request.types"

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    return request.currentUser
  },
)
