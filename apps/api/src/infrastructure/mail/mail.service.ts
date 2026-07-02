import { Injectable } from "@nestjs/common"
import { MailerService } from "@nestjs-modules/mailer"

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendBoardInvitation(
    toEmail: string,
    inviterName: string,
    boardName: string,
    inviteUrl: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: toEmail,
      subject: `Bạn được mời tham gia bảng vẽ "${boardName}"`,
      template: "./board-invitation",
      context: {
        inviterName,
        boardName,
        inviteUrl,
      },
    })
  }
}
