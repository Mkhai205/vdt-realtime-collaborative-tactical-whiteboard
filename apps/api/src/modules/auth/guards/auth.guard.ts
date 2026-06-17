import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator"
import type { RequestWithCurrentUser } from "../../../common/types/request.types"
import { AuthService } from "../auth.service"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    try {
      request.currentUser = await this.authService.resolveRestIdentity(
        request.headers,
      )
    } catch (error) {
      if (isPublic) {
        return true
      }
      throw error
    }

    return true
  }
}
