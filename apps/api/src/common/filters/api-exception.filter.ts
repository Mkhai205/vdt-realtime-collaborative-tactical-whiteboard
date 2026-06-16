import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common"
import type { Response } from "express"
import { apiErrorSchema, type ApiError } from "@rctw/shared-contracts"

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    response.status(status).json(this.toApiError(exception))
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof HttpException) {
      const body = exception.getResponse()
      const parsed = apiErrorSchema.safeParse(body)

      if (parsed.success) {
        return parsed.data
      }

      if (typeof body === "object" && body !== null && "message" in body) {
        return {
          code: this.codeForStatus(exception.getStatus()),
          message: this.messageFromBody(body),
          details: body,
        }
      }

      return {
        code: this.codeForStatus(exception.getStatus()),
        message: exception.message,
      }
    }

    return {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error.",
    }
  }

  private codeForStatus(status: number): ApiError["code"] {
    switch (status) {
      case 401:
        return "UNAUTHENTICATED"
      case 403:
        return "PERMISSION_DENIED"
      case 400:
        return "VALIDATION_ERROR"
      case 404:
        return "BOARD_NOT_FOUND"
      default:
        return "INTERNAL_ERROR"
    }
  }

  private messageFromBody(body: object): string {
    const message = (body as { message?: unknown }).message

    if (Array.isArray(message)) {
      return message.join("; ")
    }

    if (typeof message === "string") {
      return message
    }

    return "Request failed."
  }
}
