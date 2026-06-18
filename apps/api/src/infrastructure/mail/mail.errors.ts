export class MailError extends Error {
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.cause = cause
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class MailConnectionError extends MailError {
  constructor(message = "Unable to connect to mail service", cause?: unknown) {
    super(message, cause)
  }
}

export class MailSendError extends MailError {
  constructor(message = "Unable to send email", cause?: unknown) {
    super(message, cause)
  }
}
