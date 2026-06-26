import { Global, Module } from "@nestjs/common"
import { MailerModule } from "@nestjs-modules/mailer"
import { HandlebarsAdapter } from "@nestjs-modules/mailer/adapters/handlebars.adapter"
import { ConfigService } from "@nestjs/config"
import { join } from "path"
import { MailService } from "./mail.service"

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>("MAIL_SMTP_HOST")
        const port = configService.getOrThrow<number>("MAIL_SMTP_PORT")
        const secure = configService.getOrThrow<boolean>("MAIL_SMTP_SECURE")
        const user = configService.getOrThrow<string>("MAIL_SMTP_USER")
        const password = configService.getOrThrow<string>("MAIL_SMTP_PASSWORD")
        const fromEmail = configService.getOrThrow<string>("MAIL_SMTP_FROM")

        return {
          transport: {
            host,
            port,
            secure,
            auth: {
              user,
              pass: password,
            },
          },
          defaults: {
            from: fromEmail,
          },
          template: {
            dir: join(__dirname, "templates"),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        }
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
