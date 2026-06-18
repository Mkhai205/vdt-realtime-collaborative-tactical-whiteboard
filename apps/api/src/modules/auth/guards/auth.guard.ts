import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator"
import type { RequestWithCurrentUser } from "../../../common/types/request.types"
import { AuthService } from "../auth.service"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    const accessToken = this.authService.getBearerToken(
      request.headers.authorization ?? "",
    )
    const payload = await this.authService.verifyAccessToken(accessToken)
    request.currentUser = payload

    // Asynchronously update user's lastSeenAt
    void this.authService.updateLastSeen(payload.sub as string)

    return true
  }
}
