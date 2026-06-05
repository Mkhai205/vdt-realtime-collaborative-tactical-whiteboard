import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { IdentityGuard } from "./identity.guard"

@Injectable()
export class GuestIdentityGuard implements CanActivate {
  constructor(private readonly identityGuard: IdentityGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.identityGuard.canActivate(context)
  }
}
