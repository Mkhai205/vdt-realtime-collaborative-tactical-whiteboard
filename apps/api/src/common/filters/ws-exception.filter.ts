import { ArgumentsHost, Catch, Logger } from "@nestjs/common"
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets"
import { Socket } from "socket.io"

import { AppException } from "../exceptions/app.exception"

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name)

  override catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>()

    if (exception instanceof AppException) {
      const body = exception.getResponse() as any

      client.emit("exception", {
        success: false,
        code: body.code,
        message: body.message,
        errors: body.errors,
      })

      return
    }

    if (exception instanceof WsException) {
      super.catch(exception, host)
      return
    }

    this.logError(exception, client)

    client.emit("exception", {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    })
  }

  private logError(exception: unknown, client: Socket): void {
    this.logger.error(
      `Exception thrown for client ${client.id}`,
      exception instanceof Error ? exception.stack : undefined,
    )
  }
}
