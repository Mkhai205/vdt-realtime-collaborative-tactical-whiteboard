import { IoAdapter } from "@nestjs/platform-socket.io"
import { ServerOptions } from "socket.io"
import { INestApplicationContext } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

export class SocketIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app)
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const configService = this.app.get(ConfigService)
    const corsOrigins = configService.get<string | string[]>("CORS_ORIGIN")

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigins,
        credentials: true,
      },
    })

    return server
  }
}
