import { HttpException } from "@nestjs/common"
import {
  clientOpIdSchema,
  operationRejectedReasonSchema,
  whiteboardObjectSchema,
  type OperationRejectedEvent,
  type OperationRejectedReason,
  type SocketErrorEvent,
  type WhiteboardObject,
} from "@rctw/shared-contracts"
import { z } from "zod"

export type OperationRejectionContext = {
  clientOpId: string
  roomId: string
}

type LogUnexpectedError = (message: string, error: unknown) => void

const operationRejectionContextSchema = z.object({
  clientOpId: clientOpIdSchema,
  roomId: z.uuid(),
})

export function toValidationSocketError(error: z.ZodError): SocketErrorEvent {
  return {
    code: "VALIDATION_ERROR",
    message: "Invalid socket payload.",
    details: z.treeifyError(error),
  }
}

export function toSocketError(
  error: unknown,
  logUnexpectedError: LogUnexpectedError,
): SocketErrorEvent {
  if (isHttpException(error)) {
    const response = error.getResponse()

    if (isErrorResponse(response)) {
      return {
        code: response.code,
        message: response.message,
        details: response.details,
      }
    }

    return {
      code: codeForStatus(error.getStatus()),
      message: error.message,
    }
  }

  logUnexpectedError("Unexpected realtime error", error)

  return {
    code: "INTERNAL_ERROR",
    message: "Unexpected realtime server error.",
  }
}

export function toOperationRejectedEvent(
  error: unknown,
  context: OperationRejectionContext,
  logUnexpectedError: LogUnexpectedError,
): OperationRejectedEvent {
  if (isHttpException(error)) {
    const response = error.getResponse()

    if (isErrorResponse(response)) {
      return operationRejected(context, {
        reason: toOperationRejectedReason(response.code, error.getStatus()),
        message: response.message,
        latestObject: latestObjectFromDetails(response.details),
        currentRoomRevision: currentRoomRevisionFromDetails(response.details),
      })
    }

    return operationRejected(context, {
      reason: toOperationRejectedReason(undefined, error.getStatus()),
      message: error.message,
    })
  }

  logUnexpectedError("Unexpected realtime operation error", error)

  return operationRejected(context, {
    reason: "INTERNAL_ERROR",
    message: "Unexpected realtime operation error.",
  })
}

export function operationRejected(
  context: OperationRejectionContext,
  input: {
    reason: OperationRejectedReason
    message: string
    latestObject?: WhiteboardObject | null
    currentRoomRevision?: number
  },
): OperationRejectedEvent {
  return {
    clientOpId: context.clientOpId,
    roomId: context.roomId,
    reason: input.reason,
    message: input.message,
    latestObject: input.latestObject,
    currentRoomRevision: input.currentRoomRevision,
  }
}

export function parseOperationRejectionContext(
  payload: unknown,
): OperationRejectionContext | null {
  const parsed = operationRejectionContextSchema.safeParse(payload)

  return parsed.success ? parsed.data : null
}

function toOperationRejectedReason(
  code: string | undefined,
  status: number,
): OperationRejectedReason {
  if (code && operationRejectedReasonSchema.safeParse(code).success) {
    return code as OperationRejectedReason
  }

  if (code === "VALIDATION_ERROR") {
    return "INVALID_OPERATION_PAYLOAD"
  }

  if (code === "UNAUTHENTICATED") {
    return "PERMISSION_DENIED"
  }

  switch (status) {
    case 400:
      return "INVALID_OPERATION_PAYLOAD"
    case 403:
    case 401:
      return "PERMISSION_DENIED"
    case 404:
      return "OBJECT_NOT_FOUND"
    default:
      return "INTERNAL_ERROR"
  }
}

function latestObjectFromDetails(
  details: unknown,
): WhiteboardObject | null | undefined {
  if (
    typeof details !== "object" ||
    details === null ||
    !("latestObject" in details)
  ) {
    return undefined
  }

  const parsed = whiteboardObjectSchema
    .nullable()
    .safeParse((details as { latestObject?: unknown }).latestObject)

  return parsed.success ? parsed.data : undefined
}

function currentRoomRevisionFromDetails(details: unknown): number | undefined {
  if (
    typeof details !== "object" ||
    details === null ||
    !("currentRoomRevision" in details)
  ) {
    return undefined
  }

  const revision = (details as { currentRoomRevision?: unknown })
    .currentRoomRevision

  if (typeof revision !== "number") {
    return undefined
  }

  return Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined
}

function isHttpException(error: unknown): error is HttpException {
  return (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    "getResponse" in error
  )
}

function isErrorResponse(value: unknown): value is SocketErrorEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  )
}

function codeForStatus(status: number): string {
  switch (status) {
    case 401:
      return "UNAUTHENTICATED"
    case 403:
      return "PERMISSION_DENIED"
    case 404:
      return "ROOM_NOT_FOUND"
    case 400:
      return "VALIDATION_ERROR"
    default:
      return "INTERNAL_ERROR"
  }
}
