export type SendMailParams = {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export type SendMailResult = {
  messageId: string
  accepted: string[]
  rejected: string[]
}

export type MailClientConfig = {
  host: string
  port: number
  secure: boolean
  connectionTimeout: number
  user: string
  password: string
  defaultFromEmail: string
  defaultFromName: string
}
