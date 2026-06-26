import { Injectable } from "@nestjs/common"
import {
  type OperationAppliedEvent,
  type UndoRedoOperation,
  type JwtPayload,
} from "@rctw/shared-contracts"
import { WhiteboardObjectsService } from "./whiteboard-objects.service"

@Injectable()
export class WhiteboardHistoryService {
  constructor(
    private readonly whiteboardObjectsService: WhiteboardObjectsService,
  ) {}

  processUndoRedoOperation(
    currentUser: JwtPayload,
    boardId: string,
    clientOpId: string,
    operation: UndoRedoOperation,
  ): Promise<OperationAppliedEvent> {
    switch (operation.type) {
      case "OBJECT_CREATE": {
        const { object, baseRoomRevision } = operation

        return this.whiteboardObjectsService.createObject(
          currentUser,
          boardId,
          {
            clientOpId,
            baseRoomRevision,
            object,
          },
        )
      }
      case "OBJECT_UPDATE": {
        const { objectId, baseRoomRevision, baseObjectVersion, patch } =
          operation

        return this.whiteboardObjectsService.updateObject(
          currentUser,
          boardId,
          objectId,
          {
            clientOpId,
            baseRoomRevision,
            baseObjectVersion,
            patch,
          },
        )
      }
      case "OBJECT_DELETE": {
        const { objectId, baseRoomRevision, baseObjectVersion } = operation

        return this.whiteboardObjectsService.deleteObject(
          currentUser,
          boardId,
          objectId,
          {
            clientOpId,
            baseRoomRevision,
            baseObjectVersion,
          },
        )
      }
      case "OBJECT_RESTORE": {
        const { objectId, baseRoomRevision, baseObjectVersion } = operation

        return this.whiteboardObjectsService.restoreObject(
          currentUser,
          boardId,
          objectId,
          {
            clientOpId,
            baseRoomRevision,
            baseObjectVersion,
          },
        )
      }
    }
  }
}
