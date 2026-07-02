import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { AppException } from "../../../common/exceptions"
import {
  type BoardShareLinkResponse,
  type CreateBoardShareLinkRequest,
  type JoinBoardByLinkRequest,
  type JwtPayload,
} from "@rctw/shared-contracts"

@Injectable()
export class BoardShareLinkService {
  private readonly frontendUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000"
  }

  private buildUrl(token: string): string {
    return `${this.frontendUrl}/join?token=${token}`
  }

  async listShareLinks(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<BoardShareLinkResponse[]> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    let links = await this.prisma.boardJoinLink.findMany({
      where: { boardId },
      orderBy: { createdAt: "asc" },
    })

    // Nếu rỗng, tự động tạo 1 link mặc định với role EDITOR
    if (links.length === 0) {
      const defaultLink = await this.prisma.boardJoinLink.create({
        data: {
          boardId,
          role: "EDITOR",
        },
      })
      links = [defaultLink]
    }

    return links.map((link) => ({
      id: link.id,
      token: link.token,
      role: link.role,
      url: this.buildUrl(link.token),
      createdAt: link.createdAt.toISOString(),
    }))
  }

  async createShareLink(
    currentUser: JwtPayload,
    boardId: string,
    request: CreateBoardShareLinkRequest,
  ): Promise<BoardShareLinkResponse> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const created = await this.prisma.boardJoinLink.create({
      data: {
        // token sẽ được tự động tạo ra bởi Prisma với kiểu dữ liệu UUID
        boardId,
        role: request.role,
      },
    })

    return {
      id: created.id,
      token: created.token,
      role: created.role,
      url: this.buildUrl(created.token),
      createdAt: created.createdAt.toISOString(),
    }
  }

  async revokeShareLink(
    currentUser: JwtPayload,
    boardId: string,
    linkId: string,
  ): Promise<void> {
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    const link = await this.prisma.boardJoinLink.findFirst({
      where: { id: linkId, boardId },
    })

    if (!link) {
      throw AppException.validationError("Share link not found on this board.")
    }

    await this.prisma.boardJoinLink.delete({
      where: { id: linkId },
    })
  }

  async joinBoardByLink(
    currentUser: JwtPayload,
    request: JoinBoardByLinkRequest,
  ): Promise<{ boardId: string; role: string }> {
    const link = await this.prisma.boardJoinLink.findUnique({
      where: { token: request.token },
    })

    if (!link) {
      throw AppException.validationError("Invalid or expired share link token.")
    }

    const { boardId, role } = link

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
    })

    return {
      boardId,
      role,
    }
  }
}
