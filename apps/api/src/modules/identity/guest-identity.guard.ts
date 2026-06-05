import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { IdentityService } from "./identity.service"
import type { RequestWithCurrentUser } from "./identity.types"

@Injectable()
export class GuestIdentityGuard implements CanActivate {
  constructor(private readonly identityService: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>()

    request.currentUser = await this.identityService.resolveRestIdentity(
      request.headers,
    )

    return true
  }
}
