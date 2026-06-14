import type {
  ObjectCreateSocketRequest,
  ObjectMutablePatch,
  OperationAppliedEvent,
  UndoRedoOperation,
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
  redoBaseObjectVersion?: number
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

export function createUndoOperation(
  entry: WhiteboardHistoryEntry,
): UndoRedoOperation | null {
  switch (entry.type) {
    case "OBJECT_CREATE": {
      const baseObjectVersion = entry.afterObject?.version

      return baseObjectVersion
        ? {
            type: "OBJECT_DELETE",
            objectId: entry.objectId,
            baseObjectVersion,
          }
        : null
    }
    case "OBJECT_UPDATE": {
      const patch = createPreviousValuesPatch(entry)
      const baseObjectVersion = entry.afterObject?.version

      return patch && baseObjectVersion
        ? {
            type: "OBJECT_UPDATE",
            objectId: entry.objectId,
            baseObjectVersion,
            patch,
          }
        : null
    }
    case "OBJECT_DELETE": {
      const baseObjectVersion = entry.afterObject?.version

      return baseObjectVersion
        ? {
            type: "OBJECT_RESTORE",
            objectId: entry.objectId,
            baseObjectVersion,
          }
        : null
    }
  }
}

export function createRedoOperation(
  entry: WhiteboardHistoryEntry,
): UndoRedoOperation | null {
  const baseObjectVersion = entry.redoBaseObjectVersion

  if (!baseObjectVersion) {
    return null
  }

  switch (entry.forwardAction.type) {
    case "OBJECT_CREATE":
      return {
        type: "OBJECT_RESTORE",
        objectId: entry.objectId,
        baseObjectVersion,
      }
    case "OBJECT_UPDATE":
      return {
        type: "OBJECT_UPDATE",
        objectId: entry.objectId,
        baseObjectVersion,
        patch: cloneMutablePatch(entry.forwardAction.patch),
      }
    case "OBJECT_DELETE":
      return {
        type: "OBJECT_DELETE",
        objectId: entry.objectId,
        baseObjectVersion,
      }
  }
}

export function createRedoStackEntryAfterUndo(
  entry: WhiteboardHistoryEntry,
  operation: OperationAppliedEvent,
): WhiteboardHistoryEntry | null {
  const redoBaseObjectVersion = operation.resultingObject?.version

  return redoBaseObjectVersion
    ? {
        ...entry,
        redoBaseObjectVersion,
      }
    : null
}

export function createUndoStackEntryAfterRedo(
  entry: WhiteboardHistoryEntry,
  operation: OperationAppliedEvent,
): WhiteboardHistoryEntry | null {
  const afterObject = operation.resultingObject

  return afterObject
    ? {
        ...entry,
        afterObject: cloneWhiteboardObject(afterObject),
        redoBaseObjectVersion: undefined,
      }
    : null
}

export function clearWhiteboardHistoryStacks(): WhiteboardHistoryStacks {
  return {
    undoStack: [],
    redoStack: [],
  }
}

function createPreviousValuesPatch(
  entry: WhiteboardHistoryEntry,
): ObjectMutablePatch | null {
  if (entry.forwardAction.type !== "OBJECT_UPDATE" || !entry.beforeObject) {
    return null
  }

  const beforeObject = entry.beforeObject
  const forwardPatch = entry.forwardAction.patch
  const patch: ObjectMutablePatch = {}

  if ("x" in forwardPatch) {
    patch.x = beforeObject.x
  }

  if ("y" in forwardPatch) {
    patch.y = beforeObject.y
  }

  if ("width" in forwardPatch && beforeObject.width != null) {
    patch.width = beforeObject.width
  }

  if ("height" in forwardPatch && beforeObject.height != null) {
    patch.height = beforeObject.height
  }

  if ("points" in forwardPatch && beforeObject.points) {
    patch.points = [...beforeObject.points]
  }

  if ("text" in forwardPatch && beforeObject.text != null) {
    patch.text = beforeObject.text
  }

  if ("rotation" in forwardPatch) {
    patch.rotation = beforeObject.rotation
  }

  if ("style" in forwardPatch) {
    patch.style = { ...beforeObject.style }
  }

  if ("zIndex" in forwardPatch) {
    patch.zIndex = beforeObject.zIndex
  }

  return Object.keys(patch).length > 0 ? patch : null
}

function cloneMutablePatch(patch: ObjectMutablePatch): ObjectMutablePatch {
  return {
    ...patch,
    points: patch.points ? [...patch.points] : patch.points,
    style: patch.style ? { ...patch.style } : patch.style,
  }
}
