import { ArgumentsHost, Catch, Logger } from "@nestjs/common"
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets"
import { Socket } from "socket.io"
import { ServerEvents } from "@rctw/shared-contracts"

import { AppException } from "../exceptions/app.exception"

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name)

  override catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>()

    if (exception instanceof AppException) {
      this.logger.warn(
        `AppException for client ${client.id}: ${exception.message}`,
      )

      const body = exception.getResponse() as {
        code?: string
        message?: string
        errors?: string[]
      }

      client.emit(ServerEvents.ERROR, {
        code: body.code,
        message: body.message,
        errors: body.errors,
      })

      return
    }

    if (exception instanceof WsException) {
      const error = exception.getError()
      const message =
        typeof error === "string" ? error : (error as any)?.message

      client.emit(ServerEvents.ERROR, {
        code: "WS_EXCEPTION",
        message: message || "WebSocket error",
      })

      return
    }

    this.logError(exception, client)

    client.emit(ServerEvents.ERROR, {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    })
  }

  private logError(exception: unknown, client: Socket): void {
    this.logger.error(
      `Unhandled exception for client ${client.id}`,
      exception instanceof Error ? exception.stack : String(exception),
    )
  }
}
