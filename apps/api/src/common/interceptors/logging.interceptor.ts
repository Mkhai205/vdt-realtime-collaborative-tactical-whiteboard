import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common"
import type { Request, Response } from "express"
import { Observable } from "rxjs"
import { tap } from "rxjs/operators"

@Injectable()
export class LoggingInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly logger = new Logger("HTTP")

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>()
    const { method, url, ip } = request
    const userAgent = request.get("user-agent") || "-"
    const startTime = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>()
          const { statusCode } = response
          const responseTime = Date.now() - startTime

          this.logger.log(
            `${method} ${url} - ${statusCode} - ${responseTime}ms - ${ip} - ${userAgent}`,
          )
        },
        error: (error: unknown) => {
          const responseTime = Date.now() - startTime
          const statusCode = this.statusCodeFromError(error)

          this.logger.error(
            `${method} ${url} - ${statusCode} - ${responseTime}ms - ${ip} - ${userAgent}`,
            error instanceof Error ? error.stack : undefined,
          )
        },
      }),
    )
  }

  private statusCodeFromError(error: unknown): number {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
    ) {
      return (error as { status: number }).status
    }

    return 500
  }
}
