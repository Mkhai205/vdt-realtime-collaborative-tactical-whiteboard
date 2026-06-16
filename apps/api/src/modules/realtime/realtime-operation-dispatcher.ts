import {
  type OperationAppliedEvent,
  type UndoRedoOperation,
  type UserSummary,
} from "@rctw/shared-contracts"
import type { WhiteboardObjectsService } from "../whiteboard-objects"

export function processUndoRedoOperation(
  whiteboardObjectsService: WhiteboardObjectsService,
  currentUser: UserSummary,
  boardId: string,
  clientOpId: string,
  operation: UndoRedoOperation,
): Promise<OperationAppliedEvent> {
  switch (operation.type) {
    case "OBJECT_CREATE": {
      const { object, baseRoomRevision } = operation

      return whiteboardObjectsService.createObject(currentUser, boardId, {
        clientOpId,
        baseRoomRevision,
        object,
      })
    }
    case "OBJECT_UPDATE": {
      const { objectId, baseRoomRevision, baseObjectVersion, patch } = operation

      return whiteboardObjectsService.updateObject(
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

      return whiteboardObjectsService.deleteObject(
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

      return whiteboardObjectsService.restoreObject(
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
