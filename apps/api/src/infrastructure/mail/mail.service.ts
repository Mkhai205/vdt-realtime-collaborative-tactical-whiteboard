import { Injectable } from "@nestjs/common"
import { MailerService } from "@nestjs-modules/mailer"

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerifyEmail(email: string, name: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: "Verify your email",
      template: "verify-email",
      context: {
        name,
        code,
      },
    })
  }

  async sendWelcomeEmail(email: string, name: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: "Welcome to Realtime Collaborative Tactical Whiteboard",
      template: "welcome",
      context: {
        name,
      },
    })
  }
}
