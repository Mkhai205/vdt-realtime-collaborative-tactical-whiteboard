import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import type { RequestWithCurrentUser } from "../../../common/types/request.types"
import { AuthService } from "../auth.service"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    request.currentUser = await this.authService.resolveRestIdentity(
      request.headers,
    )

    return true
  }
}
