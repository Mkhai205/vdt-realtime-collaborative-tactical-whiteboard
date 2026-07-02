import { Injectable } from "@nestjs/common"
import { Socket } from "socket.io"
import {
  type JwtPayload,
  type UndoRedoEvent,
  toBoardSocketName,
  ServerEvents,
  type UndoRequest,
  type RedoRequest,
} from "@rctw/shared-contracts"
import { WhiteboardMutationService } from "../../board/service/board-objects.service"
import { BoardSnapshotService } from "../../board/service/board-snapshot.service"
import { AppException } from "../../../common/exceptions"

@Injectable()
export class OperationHandler {
  constructor(
    private readonly mutationService: WhiteboardMutationService,
    private readonly snapshotService: BoardSnapshotService,
  ) {}

  /**
   * Hoàn tác (Undo)
   */
  async undo(client: Socket, dto: UndoRequest): Promise<void> {
    const { boardId } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    const result = await this.mutationService.undoOperation(
      currentUser,
      boardId,
    )

    let event: UndoRedoEvent
    if (result.kind === "deleted") {
      event = {
        boardId,
        action: "UNDO",
        object: null,
        objectId: result.objectId,
        operation: result.operation,
      }
    } else {
      event = {
        boardId,
        action: "UNDO",
        object: result.object,
        objectId: result.object.id,
        operation: result.operation,
      }
    }

    // Emit tới tất cả các clients trong room (bao gồm cả client gửi undo)
    client.nsp.to(roomName).emit(ServerEvents.UNDO_REDO, event)

    // Trigger auto-snapshot check
    void this.snapshotService.maybeAutoSnapshot(boardId)
  }

  /**
   * Làm lại (Redo)
   */
  async redo(client: Socket, dto: RedoRequest): Promise<void> {
    const { boardId } = dto
    const roomName = toBoardSocketName(boardId)

    const currentUser = client.data.currentUser as JwtPayload
    if (!currentUser) throw AppException.unauthenticated()

    const result = await this.mutationService.redoOperation(
      currentUser,
      boardId,
    )

    let event: UndoRedoEvent
    if (result.kind === "deleted") {
      event = {
        boardId,
        action: "REDO",
        object: null,
        objectId: result.objectId,
        operation: result.operation,
      }
    } else {
      event = {
        boardId,
        action: "REDO",
        object: result.object,
        objectId: result.object.id,
        operation: result.operation,
      }
    }

    // Emit tới tất cả các clients trong room (bao gồm cả client gửi redo)
    client.nsp.to(roomName).emit(ServerEvents.UNDO_REDO, event)

    // Trigger auto-snapshot check
    void this.snapshotService.maybeAutoSnapshot(boardId)
  }
}
