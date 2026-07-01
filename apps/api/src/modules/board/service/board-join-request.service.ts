import { Injectable } from "@nestjs/common"
import {
  boardVisibility,
  boardRoles,
  type JwtPayload,
  type UserSummary,
  type RespondJoinRequest,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../../infrastructure/database"
import { BoardPermissionService } from "./board-permission.service"
import { AppException } from "../../../common/exceptions"
import { EventBrokerService } from "../../../infrastructure/event-broker/event-broker.service"
import { userSummarySelect } from "../../user/user.service"

@Injectable()
export class BoardJoinRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardPermissionService: BoardPermissionService,
    private readonly eventBroker: EventBrokerService,
  ) {}

  /**
   * User xin tham gia board PUBLIC
   */
  async createJoinRequest(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<{ id: string; boardId: string; status: string; createdAt: Date }> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, visibility: true, name: true },
    })

    if (!board) {
      throw AppException.boardNotFound()
    }

    if (board.visibility !== boardVisibility.PUBLIC) {
      throw AppException.permissionDenied(
        "Only public boards accept join requests.",
      )
    }

    // Kiểm tra xem đã là member chưa
    const existingMember = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: currentUser.sub,
        },
      },
    })

    if (existingMember) {
      throw AppException.conflict("You are already a member of this board.")
    }

    // Kiểm tra request pending
    const pendingRequest = await this.prisma.boardJoinRequest.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: currentUser.sub,
        },
      },
    })

    if (pendingRequest) {
      if (pendingRequest.status === "PENDING") {
        throw AppException.conflict("You already have a pending join request.")
      }
      // Nếu đã APPROVED hoặc REJECTED, cho phép tạo lại (ví dụ sau khi bị kick hoặc muốn gửi lại sau khi bị từ chối)
      await this.prisma.boardJoinRequest.delete({
        where: { id: pendingRequest.id },
      })
    }

    const created = await this.prisma.boardJoinRequest.create({
      data: {
        boardId,
        userId: currentUser.sub,
        status: "PENDING",
      },
      include: {
        user: { select: userSummarySelect },
      },
    })

    // Emit event để notify owners qua WS gateway
    this.eventBroker.publish("join-request:created", {
      boardId,
      requestId: created.id,
      user: created.user,
      createdAt: created.createdAt.toISOString(),
    })

    return {
      id: created.id,
      boardId: created.boardId,
      status: created.status,
      createdAt: created.createdAt,
    }
  }

  /**
   * Owner xem danh sách requests của board
   */
  async listJoinRequests(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<
    Array<{
      id: string
      boardId: string
      status: string
      createdAt: Date
      user: UserSummary
    }>
  > {
    // Chỉ Owner mới được xem
    await this.boardPermissionService.assertFormalOwner(
      currentUser.sub,
      boardId,
    )

    const requests = await this.prisma.boardJoinRequest.findMany({
      where: {
        boardId,
        status: "PENDING",
      },
      include: {
        user: { select: userSummarySelect },
      },
      orderBy: { createdAt: "asc" },
    })

    return requests.map((r) => ({
      id: r.id,
      boardId: r.boardId,
      status: r.status,
      createdAt: r.createdAt,
      user: r.user,
    }))
  }

  /**
   * Owner duyệt/từ chối request
   */
  async respondToJoinRequest(
    currentUser: JwtPayload,
    boardId: string,
    requestId: string,
    body: RespondJoinRequest,
  ): Promise<{ id: string; boardId: string; status: string; userId: string }> {
    // Chỉ Owner mới được duyệt
    await this.boardPermissionService.assertFormalOwner(
      currentUser.sub,
      boardId,
    )

    const request = await this.prisma.boardJoinRequest.findUnique({
      where: { id: requestId },
    })

    if (!request || request.boardId !== boardId) {
      throw AppException.validationError(
        "Join request not found on this board.",
      )
    }

    if (request.status !== "PENDING") {
      throw AppException.validationError(
        `Join request is already ${request.status}.`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const status = body.action === "APPROVE" ? "APPROVED" : "REJECTED"

      const updated = await tx.boardJoinRequest.update({
        where: { id: requestId },
        data: { status },
      })

      if (body.action === "APPROVE") {
        // Thêm user vào board member với role EDITOR mặc định
        await tx.boardMember.create({
          data: {
            boardId,
            userId: request.userId,
            role: boardRoles.EDITOR,
          },
        })
      }

      return {
        id: updated.id,
        boardId: updated.boardId,
        status: updated.status,
        userId: updated.userId,
      }
    })
  }
}
