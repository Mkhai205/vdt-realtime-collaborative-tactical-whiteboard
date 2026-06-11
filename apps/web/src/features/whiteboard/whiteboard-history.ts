import type {
  ObjectCreateSocketRequest,
  ObjectMutablePatch,
  OperationAppliedEvent,
  WhiteboardObject,
} from "@rctw/shared-contracts"

export type WhiteboardHistoryOperationType =
  | "OBJECT_CREATE"
  | "OBJECT_UPDATE"
  | "OBJECT_DELETE"

export type WhiteboardHistoryForwardAction =
  | {
      type: "OBJECT_CREATE"
      object: ObjectCreateSocketRequest["object"]
    }
  | {
      type: "OBJECT_UPDATE"
      patch: ObjectMutablePatch
    }
  | {
      type: "OBJECT_DELETE"
    }

export type PendingWhiteboardHistoryEntry = {
  type: WhiteboardHistoryOperationType
  objectId: string
  beforeObject: WhiteboardObject | null
  afterObject: WhiteboardObject | null
  forwardAction: WhiteboardHistoryForwardAction
}

export type WhiteboardHistoryEntry = PendingWhiteboardHistoryEntry & {
  operationId: string
  clientOpId: string
  roomId: string
  revision: number
  objectId: string
  createdAt: string
}

export type WhiteboardHistoryStacks = {
  undoStack: WhiteboardHistoryEntry[]
  redoStack: WhiteboardHistoryEntry[]
}

export type WhiteboardHistoryMoveResult = WhiteboardHistoryStacks & {
  movedEntry: WhiteboardHistoryEntry | null
}

export function cloneWhiteboardObject(
  object: WhiteboardObject | null | undefined,
): WhiteboardObject | null {
  if (!object) {
    return null
  }

  return {
    ...object,
    points: object.points ? [...object.points] : object.points,
    style: { ...object.style },
  }
}

export function createWhiteboardHistoryEntry(
  operation: OperationAppliedEvent,
  pendingEntry: PendingWhiteboardHistoryEntry | null | undefined,
): WhiteboardHistoryEntry | null {
  if (!pendingEntry || operation.type !== pendingEntry.type) {
    return null
  }

  const objectId =
    operation.objectId ?? operation.resultingObject?.id ?? pendingEntry.objectId

  if (!objectId) {
    return null
  }

  return {
    ...pendingEntry,
    operationId: operation.operationId,
    clientOpId: operation.clientOpId,
    roomId: operation.roomId,
    revision: operation.revision,
    objectId,
    createdAt: operation.createdAt,
    beforeObject: cloneWhiteboardObject(pendingEntry.beforeObject),
    afterObject: cloneWhiteboardObject(
      operation.resultingObject ?? pendingEntry.afterObject,
    ),
  }
}

export function pushUndoStackEntry(
  undoStack: WhiteboardHistoryEntry[],
  entry: WhiteboardHistoryEntry,
): WhiteboardHistoryStacks {
  return {
    undoStack: [...undoStack, entry],
    redoStack: [],
  }
}

export function moveLatestUndoToRedo(
  undoStack: WhiteboardHistoryEntry[],
  redoStack: WhiteboardHistoryEntry[],
): WhiteboardHistoryMoveResult {
  const movedEntry = undoStack.at(-1) ?? null

  if (!movedEntry) {
    return {
      undoStack,
      redoStack,
      movedEntry: null,
    }
  }

  return {
    undoStack: undoStack.slice(0, -1),
    redoStack: [...redoStack, movedEntry],
    movedEntry,
  }
}

export function moveLatestRedoToUndo(
  undoStack: WhiteboardHistoryEntry[],
  redoStack: WhiteboardHistoryEntry[],
): WhiteboardHistoryMoveResult {
  const movedEntry = redoStack.at(-1) ?? null

  if (!movedEntry) {
    return {
      undoStack,
      redoStack,
      movedEntry: null,
    }
  }

  return {
    undoStack: [...undoStack, movedEntry],
    redoStack: redoStack.slice(0, -1),
    movedEntry,
  }
}

export function clearWhiteboardHistoryStacks(): WhiteboardHistoryStacks {
  return {
    undoStack: [],
    redoStack: [],
  }
}
