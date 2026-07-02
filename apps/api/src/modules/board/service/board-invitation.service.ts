import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { MailService } from "../../../infrastructure/mail/mail.service"
import { AppException } from "../../../common/exceptions"
import { userSummarySelect } from "../../user/user.service"
import { Prisma } from "@rctw/database"
import {
  type BoardInvitationResponse,
  type CreateBoardInvitationRequest,
  type AcceptBoardInvitationRequest,
  type JwtPayload,
} from "@rctw/shared-contracts"

const invitationSelect = {
  id: true,
  boardId: true,
  email: true,
  role: true,
  token: true,
  expiresAt: true,
  createdAt: true,
  invitedBy: { select: userSummarySelect },
} satisfies Prisma.BoardInvitationSelect

type BoardInvitationRecord = Prisma.BoardInvitationGetPayload<{
  select: typeof invitationSelect
}>

@Injectable()
export class BoardInvitationService {
  private readonly frontendUrl: string
  private readonly logger = new Logger(BoardInvitationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000"
  }

  private toInvitationResponse(
    record: BoardInvitationRecord,
  ): BoardInvitationResponse {
    return {
      id: record.id,
      boardId: record.boardId,
      email: record.email,
      role: record.role as "EDITOR" | "VIEWER",
      token: record.token,
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      invitedBy: record.invitedBy,
    }
  }

  async createInvitation(
    currentUser: JwtPayload,
    boardId: string,
    request: CreateBoardInvitationRequest,
  ): Promise<BoardInvitationResponse> {
    const { board } = await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const email = request.email.trim().toLowerCase()

    // 1. Kiểm tra xem người nhận đã là member của Board này chưa
    const targetUser = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    })

    if (targetUser) {
      const existingMember = await this.prisma.boardMember.findUnique({
        where: {
          boardId_userId: {
            boardId,
            userId: targetUser.id,
          },
        },
        select: { id: true },
      })

      if (existingMember) {
        throw AppException.conflict(
          `User with email "${email}" is already a member of this board.`,
        )
      }
    }

    // 2. Tạo bản ghi BoardInvitation mới
    const invitation = await this.prisma.$transaction(async (tx) => {
      // Xoá lời mời cũ nếu có cho cặp (boardId, email) để tránh lỗi @@unique
      await tx.boardInvitation.deleteMany({
        where: { boardId, email },
      })

      // Tạo lời mời mới hết hạn sau 48 giờ
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

      return tx.boardInvitation.create({
        data: {
          boardId,
          email,
          role: request.role,
          invitedById: currentUser.sub,
          expiresAt,
        },
        select: invitationSelect,
      })
    })

    // 3. Gửi email thông qua MailService
    const inviteUrl = `${this.frontendUrl}/accept-invitation?token=${invitation.token}`
    const inviterName = currentUser.name || currentUser.email || "User"

    try {
      await this.mailService.sendBoardInvitation(
        email,
        inviterName,
        board.name,
        inviteUrl,
      )
    } catch (mailError) {
      // Ghi log lỗi gửi mail nhưng vẫn trả về lời mời đã tạo trong DB
      this.logger.error(
        `Failed to send invitation email to ${email}:`,
        mailError,
      )
    }

    return this.toInvitationResponse(invitation)
  }

  async listInvitations(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<BoardInvitationResponse[]> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const invitations = await this.prisma.boardInvitation.findMany({
      where: {
        boardId,
        expiresAt: { gt: new Date() }, // Chỉ lấy các link chưa hết hạn
      },
      select: invitationSelect,
      orderBy: { createdAt: "desc" },
    })

    return invitations.map((inv) => this.toInvitationResponse(inv))
  }

  async revokeInvitation(
    currentUser: JwtPayload,
    boardId: string,
    invitationId: string,
  ): Promise<void> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const invitation = await this.prisma.boardInvitation.findFirst({
      where: { id: invitationId, boardId },
    })

    if (!invitation) {
      throw AppException.boardNotFound("Invitation not found.")
    }

    await this.prisma.boardInvitation.delete({
      where: { id: invitationId },
    })
  }

  async acceptInvitation(
    currentUser: JwtPayload,
    request: AcceptBoardInvitationRequest,
  ): Promise<{ boardId: string; role: string }> {
    const invitation = await this.prisma.boardInvitation.findUnique({
      where: { token: request.token },
    })

    if (!invitation) {
      throw AppException.validationError(
        "Lời mời không tồn tại hoặc token không hợp lệ.",
      )
    }

    if (invitation.expiresAt < new Date()) {
      // Đã hết hạn -> Xoá luôn bản ghi hết hạn này
      await this.prisma.boardInvitation.delete({
        where: { id: invitation.id },
      })
      throw AppException.validationError("Lời mời này đã hết hạn sử dụng.")
    }

    const { boardId, role, id: invitationId } = invitation

    await this.prisma.$transaction(async (tx) => {
      // Kiểm tra xem đã là member chưa
      const existing = await tx.boardMember.findUnique({
        where: {
          boardId_userId: {
            boardId,
            userId: currentUser.sub,
          },
        },
      })

      if (!existing) {
        // Thêm user hiện tại làm thành viên với role của link mời
        await tx.boardMember.create({
          data: {
            boardId,
            userId: currentUser.sub,
            role,
          },
        })
      }

      // Xoá thư mời sau khi accept thành công
      await tx.boardInvitation.delete({
        where: { id: invitationId },
      })
    })

    return {
      boardId,
      role,
    }
  }
}
