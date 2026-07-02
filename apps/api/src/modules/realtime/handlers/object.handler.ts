import { Injectable } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type ObjectCreatedAck,
  type ObjectCreatedEvent,
  type ObjectUpdatedAck,
  type ObjectUpdatedEvent,
  type ObjectDeletedAck,
  type ObjectDeletedEvent,
  toBoardSocketName,
  ServerEvents,
  type ObjectCreateRequest,
  type ObjectUpdateRequest,
  type ObjectDeleteRequest,
} from "@rctw/shared-contracts"
import { WhiteboardMutationService } from "../../board/service/board-objects.service"
import { BoardSnapshotService } from "../../board/service/board-snapshot.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class ObjectHandler {
  constructor(
    private readonly mutationService: WhiteboardMutationService,
    private readonly snapshotService: BoardSnapshotService,
  ) {}

  /**
   * Tạo object mới
   */
  async create(client: Socket, dto: ObjectCreateRequest): Promise<void> {
    const { boardId, object, clientOpId } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    const result = await this.mutationService.createObject(
      currentUser,
      boardId,
      object,
      clientOpId,
    )

    // 1. Gửi ACK về chính client gửi
    const ack: ObjectCreatedAck = {
      clientOpId,
      object: result.object,
      operation: result.operation,
    }
    client.emit(ServerEvents.OBJECT_CREATED, ack)

    // 2. Broadcast event tới các client khác trong board
    const event: ObjectCreatedEvent = {
      boardId,
      object: result.object,
      operation: result.operation,
    }
    client.to(roomName).emit(ServerEvents.OBJECT_CREATED, event)

    // 3. Trigger auto-snapshot check (background task, không block flow chính)
    void this.snapshotService.maybeAutoSnapshot(boardId)
  }

  /**
   * Cập nhật object
   */
  async update(client: Socket, dto: ObjectUpdateRequest): Promise<void> {
    const { boardId, objectId, baseVersion, patch, clientOpId } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    const result = await this.mutationService.updateObject(
      currentUser,
      boardId,
      objectId,
      patch,
      clientOpId,
      baseVersion,
    )

    // 1. Gửi ACK về chính client gửi
    const ack: ObjectUpdatedAck = {
      clientOpId,
      object: result.object,
      operation: result.operation,
    }
    client.emit(ServerEvents.OBJECT_UPDATED, ack)

    // 2. Broadcast event tới các client khác trong board
    const event: ObjectUpdatedEvent = {
      boardId,
      object: result.object,
      operation: result.operation,
    }
    client.to(roomName).emit(ServerEvents.OBJECT_UPDATED, event)

    // 3. Trigger auto-snapshot check
    void this.snapshotService.maybeAutoSnapshot(boardId)
  }

  /**
   * Xóa object (soft delete)
   */
  async delete(client: Socket, dto: ObjectDeleteRequest): Promise<void> {
    const { boardId, objectId, baseVersion, clientOpId } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    const result = await this.mutationService.deleteObject(
      currentUser,
      boardId,
      objectId,
      clientOpId,
      baseVersion,
    )

    // 1. Gửi ACK về chính client gửi
    const ack: ObjectDeletedAck = {
      clientOpId,
      objectId,
      operation: result.operation,
    }
    client.emit(ServerEvents.OBJECT_DELETED, ack)

    // 2. Broadcast event tới các client khác trong board
    const event: ObjectDeletedEvent = {
      boardId,
      objectId,
      operation: result.operation,
    }
    client.to(roomName).emit(ServerEvents.OBJECT_DELETED, event)

    // 3. Trigger auto-snapshot check
    void this.snapshotService.maybeAutoSnapshot(boardId)
  }
}
