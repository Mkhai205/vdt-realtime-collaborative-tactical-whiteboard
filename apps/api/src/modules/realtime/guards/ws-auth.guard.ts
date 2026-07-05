import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { WsException } from "@nestjs/websockets"
import { Socket } from "socket.io"
import { AuthService } from "../../auth/auth.service"

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "ws") {
      return true
    }

    const client: Socket = context.switchToWs().getClient()

    // Token có thể được gửi qua handshake auth hoặc headers
    const authHeader: string =
      client.handshake.auth?.token || client.handshake.headers?.authorization

    if (!authHeader) {
      return true
    }

    try {
      // ws-auth.guard.ts
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : authHeader

      if (!token) {
        return true
      }

      const payload = await this.authService.verifyAccessToken(token)

      // Gắn payload vào socket client data
      client.data.currentUser = payload

      return true
    } catch (err: any) {
      // Cho phép kết nối tiếp tục với tư cách guest/unauthenticated
      return true
    }
  }
}
