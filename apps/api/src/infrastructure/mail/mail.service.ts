import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import * as nodemailer from "nodemailer"
import { MailConnectionError, MailSendError } from "./mail.errors"
import type {
  MailClientConfig,
  SendMailParams,
  SendMailResult,
} from "./mail.types"

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name)
  private readonly config: MailClientConfig
  private transporter: nodemailer.Transporter | null = null

  constructor(private readonly configService: ConfigService) {
    this.config = this.getConfig()

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      connectionTimeout: this.config.connectionTimeout,
    })
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ping()
      this.logger.log("📩 Mail SMTP service initialized")
    } catch (error) {
      this.logger.error(
        "Mail SMTP service initialization failed (Ping verification failed). The service might be temporarily unavailable.",
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  async ping(): Promise<void> {
    const transporter = this.getTransporter()

    try {
      await transporter.verify()
    } catch (error: unknown) {
      throw new MailConnectionError("Unable to connect to mail service", error)
    }
  }

  async sendMail(params: SendMailParams): Promise<SendMailResult> {
    const transporter = this.getTransporter()

    try {
      const info = await transporter.sendMail({
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
        from: this.buildFromHeader(params.fromEmail, params.fromName),
      })

      const accepted = (info.accepted || [])
        .map((item: unknown) => this.normalizeRecipient(item))
        .filter((item: string) => item.length > 0)

      const rejected = (info.rejected || [])
        .map((item: unknown) => this.normalizeRecipient(item))
        .filter((item: string) => item.length > 0)

      return {
        messageId: info.messageId,
        accepted,
        rejected,
      }
    } catch (error: unknown) {
      this.logger.error(
        "Failed to send email via SMTP",
        error instanceof Error ? error.stack : undefined,
      )
      throw new MailSendError("Unable to send email", error)
    }
  }

  private buildFromHeader(fromEmail?: string, fromName?: string): string {
    const email = (fromEmail ?? this.config.defaultFromEmail ?? "").trim()

    if (!email) {
      throw new MailSendError("MAIL_FROM_EMAIL is required to send email")
    }

    const name = (fromName ?? this.config.defaultFromName).trim()
    return name ? `${name} <${email}>` : email
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      throw new MailConnectionError("Mail transporter is not initialized")
    }

    return this.transporter
  }

  private normalizeRecipient(recipient: unknown): string {
    if (typeof recipient === "string") {
      return recipient
    }

    if (
      typeof recipient === "object" &&
      recipient !== null &&
      "address" in recipient
    ) {
      const address = (recipient as { address?: unknown }).address
      if (typeof address === "string") {
        return address
      }
    }

    return ""
  }

  private getConfig(): MailClientConfig {
    const host = this.configService.getOrThrow<string>("MAIL_SMTP_HOST")
    const port = this.configService.getOrThrow<number>("MAIL_SMTP_PORT")
    const secure = this.configService.getOrThrow<boolean>("MAIL_SMTP_SECURE")
    const connectionTimeout = this.configService.getOrThrow<number>(
      "MAIL_SMTP_CONNECTION_TIMEOUT",
    )
    const user = this.configService.getOrThrow<string>("SMTP_USER")
    const password = this.configService.getOrThrow<string>("SMTP_PASSWORD")
    const defaultFromEmail =
      this.configService.getOrThrow<string>("MAIL_FROM_EMAIL")
    const defaultFromName =
      this.configService.getOrThrow<string>("MAIL_FROM_NAME")

    return {
      host,
      port,
      secure,
      connectionTimeout,
      user,
      password,
      defaultFromEmail,
      defaultFromName,
    }
  }
}
