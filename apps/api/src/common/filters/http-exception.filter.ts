import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  Logger,
  NotFoundException,
} from "@nestjs/common"

import { Request, Response } from "express"

import { AppException } from "../exceptions/app.exception"
import { Prisma } from "@rctw/database"

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()

    const request = ctx.getRequest<Request>()

    const response = ctx.getResponse<Response>()

    const now = new Date().toISOString()

    this.logError(exception, host.switchToHttp().getRequest<Request>())

    if (exception instanceof AppException) {
      const body = exception.getResponse() as any

      response.status(exception.getStatus()).json({
        success: false,

        statusCode: exception.getStatus(),

        ...body,

        timestamp: now,

        path: request.originalUrl,
      })

      return
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002":
          throw new ConflictException()

        case "P2025":
          throw new NotFoundException()
      }
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse()

      response.status(exception.getStatus()).json({
        success: false,

        statusCode: exception.getStatus(),

        code: "Bad Request",

        message: typeof body === "string" ? body : (body as any).message,

        timestamp: now,

        path: request.originalUrl,
      })

      return
    }

    response.status(500).json({
      success: false,

      statusCode: 500,

      code: "INTERNAL_SERVER_ERROR",

      message: "Internal server error",

      timestamp: now,

      path: request.originalUrl,
    })
  }

  private logError(exception: unknown, request: Request): void {
    this.logger.error(
      `${request.method} ${request.originalUrl}`,
      exception instanceof Error ? exception.stack : undefined,
    )
  }
}
