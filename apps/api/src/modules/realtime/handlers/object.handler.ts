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
  type ObjectDeletedBatchAck,
  type ObjectDeletedBatchEvent,
  toBoardSocketName,
  ServerEvents,
  type ObjectCreateRequest,
  type ObjectUpdateRequest,
  type ObjectDeleteRequest,
  type ObjectDeleteBatchRequest,
  type ObjectMoveEphemeralRequest,
  type ObjectMoveEphemeralEvent,
} from "@rctw/shared-contracts"
import { WhiteboardMutationService } from "../../board/service/board-objects.service"
import { BoardSnapshotService } from "../../board/service/board-snapshot.service"
import { PresenceService } from "../services/presence.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class ObjectHandler {
  constructor(
    private readonly mutationService: WhiteboardMutationService,
    private readonly snapshotService: BoardSnapshotService,
    private readonly presenceService: PresenceService,
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

    // Enforce lock check
    const isLocked = await this.presenceService.isLockedByOther(
      boardId,
      objectId,
      client.id,
    )
    if (isLocked) {
      throw AppException.objectLocked("Object is locked", { objectId })
    }

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

    // Enforce lock check
    const isLocked = await this.presenceService.isLockedByOther(
      boardId,
      objectId,
      client.id,
    )
    if (isLocked) {
      throw AppException.objectLocked("Object is locked", { objectId })
    }

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

  /**
   * Broadcast ephemeral object move/resize/rotate update (realtime, no DB writes)
   */
  async moveEphemeral(
    client: Socket,
    dto: ObjectMoveEphemeralRequest,
  ): Promise<void> {
    const { boardId, objectId, ...coords } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    const event: ObjectMoveEphemeralEvent = {
      boardId,
      objectId,
      ...coords,
    }

    // Broadcast to other clients in the board (except sender)
    client.to(roomName).emit(ServerEvents.OBJECT_MOVE_EPHEMERAL, event)
  }

  /**
   * Xóa nhiều objects cùng lúc (batch).
   * Lock check: skip object bị lock, xóa phần còn lại (partial success).
   */
  async deleteBatch(
    client: Socket,
    dto: ObjectDeleteBatchRequest,
  ): Promise<void> {
    const { boardId, items, clientOpId } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    // Kiểm tra lock từng object, skip các object bị lock bởi user khác
    const skippedByLock: string[] = []
    const itemsToDelete: typeof items = []

    for (const item of items) {
      const isLocked = await this.presenceService.isLockedByOther(
        boardId,
        item.objectId,
        client.id,
      )
      if (isLocked) {
        skippedByLock.push(item.objectId)
      } else {
        itemsToDelete.push(item)
      }
    }

    // Nếu tất cả bị lock thì không có gì để làm
    if (itemsToDelete.length === 0) {
      const ack: ObjectDeletedBatchAck = {
        clientOpId,
        deletedIds: [],
        skippedIds: skippedByLock,
        operations: [],
      }
      client.emit(ServerEvents.OBJECT_DELETED_BATCH, ack)
      return
    }

    const result = await this.mutationService.deleteObjectBatch(
      currentUser,
      boardId,
      itemsToDelete,
      clientOpId,
      skippedByLock,
    )

    // 1. Gửi ACK về chính client gửi
    const ack: ObjectDeletedBatchAck = {
      clientOpId,
      deletedIds: result.deletedIds,
      skippedIds: result.skippedIds,
      operations: result.operations,
    }
    client.emit(ServerEvents.OBJECT_DELETED_BATCH, ack)

    // 2. Broadcast event tới các client khác trong board
    if (result.deletedIds.length > 0) {
      const event: ObjectDeletedBatchEvent = {
        boardId,
        deletedIds: result.deletedIds,
        operations: result.operations,
      }
      client.to(roomName).emit(ServerEvents.OBJECT_DELETED_BATCH, event)
    }

    // 3. Trigger auto-snapshot check
    void this.snapshotService.maybeAutoSnapshot(boardId)
  }
}
