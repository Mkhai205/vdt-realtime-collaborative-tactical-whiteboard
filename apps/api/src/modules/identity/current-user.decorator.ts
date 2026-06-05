import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import type { UserSummary } from "@rctw/shared-contracts"
import type { RequestWithCurrentUser } from "./identity.types"

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserSummary | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    return request.currentUser
  },
)
