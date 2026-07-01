import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator"
import type { RequestWithCurrentUser } from "../../../common/types/request.types"
import { AuthService } from "../auth.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === "ws") {
      return true
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    try {
      const authorization = request.headers.authorization
      if (!authorization) {
        throw AppException.unauthenticated("Missing authorization header.")
      }

      const [type, accessToken] = authorization.split(" ")
      if (type !== "Bearer" || !accessToken) {
        throw AppException.unauthenticated(
          "Invalid authorization header format.",
        )
      }

      const payload = await this.authService.verifyAccessToken(accessToken)
      request.currentUser = payload

      return true
    } catch (err: any) {
      throw AppException.unauthenticated(
        (err.message as string) || "Invalid credentials.",
      )
    }
  }
}
