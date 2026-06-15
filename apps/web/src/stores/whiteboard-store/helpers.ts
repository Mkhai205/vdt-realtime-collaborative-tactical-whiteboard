import type {
  WhiteboardObject,
  OperationAppliedEvent,
  OperationRejectedEvent,
} from "@rctw/shared-contracts"
import type {
  WhiteboardState,
  WhiteboardToast,
  WhiteboardToastVariant,
  RemoteTransformPreview,
  RemoteEditingState,
  LocalObjectInput,
} from "./types"
import { getRoomObjects } from "@/lib/whiteboard-api"

export const maxToastCount = 3
export const objectVersionConflictToastMessage =
  "Object changed in another session. Refreshed to latest version."

let mutationQueue = Promise.resolve()

export function enqueueMutation(task: () => Promise<void>) {
  mutationQueue = mutationQueue.then(task, task)
  void mutationQueue.catch(() => undefined)
}

export function toObjectRecord(
  objects: WhiteboardObject[],
): Record<string, WhiteboardObject> {
  return Object.fromEntries(objects.map((object) => [object.id, object]))
}

export function getNextZIndex(objects: Record<string, WhiteboardObject>): number {
  const maxZIndex = Object.values(objects)
    .filter((object) => !object.deletedAt)
    .reduce((max, object) => Math.max(max, object.zIndex), 0)

  return maxZIndex + 10
}

export function removeRemoteTransformPreviews(
  previews: Record<string, RemoteTransformPreview>,
  objectIds: Array<string | null | undefined>,
): Record<string, RemoteTransformPreview> {
  const targetObjectIds = objectIds.filter((objectId): objectId is string =>
    Boolean(objectId),
  )

  if (targetObjectIds.length === 0) {
    return previews
  }

  let nextPreviews = previews

  for (const objectId of targetObjectIds) {
    if (!(objectId in nextPreviews)) {
      continue
    }

    if (nextPreviews === previews) {
      nextPreviews = { ...previews }
    }

    delete nextPreviews[objectId]
  }

  return nextPreviews
}

export function removeRemoteEditorsForObjects(
  editors: Record<string, Record<string, RemoteEditingState>>,
  objectIds: Array<string | null | undefined>,
): Record<string, Record<string, RemoteEditingState>> {
  const targetObjectIds = objectIds.filter((objectId): objectId is string =>
    Boolean(objectId),
  )

  if (targetObjectIds.length === 0) {
    return editors
  }

  let nextEditors = editors

  for (const objectId of targetObjectIds) {
    if (!(objectId in nextEditors)) {
      continue
    }

    if (nextEditors === editors) {
      nextEditors = { ...editors }
    }

    delete nextEditors[objectId]
  }

  return nextEditors
}

export function applyOperationToObjects(
  objects: Record<string, WhiteboardObject>,
  operation: OperationAppliedEvent,
  removeObjectId?: string,
): Record<string, WhiteboardObject> {
  const nextObjects = { ...objects }

  if (removeObjectId) {
    delete nextObjects[removeObjectId]
  }

  if (operation.resultingObject) {
    nextObjects[operation.resultingObject.id] = operation.resultingObject
  } else if (operation.type === "OBJECT_DELETE" && operation.objectId) {
    delete nextObjects[operation.objectId]
  }

  return nextObjects
}

export function getMonotonicRevision(
  currentRevision: number,
  nextRevision: number | undefined,
): number {
  return nextRevision === undefined
    ? currentRevision
    : Math.max(currentRevision, nextRevision)
}

export function toCreateRequestObject(input: LocalObjectInput, zIndex: number) {
  return {
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    points: input.points,
    text: input.text,
    rotation: input.rotation,
    style: input.style,
    zIndex,
  }
}

export function getOperationRejection(error: unknown): OperationRejectedEvent | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "clientOpId" in error &&
    "roomId" in error &&
    "reason" in error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return error as OperationRejectedEvent
  }

  return null
}

export function getWhiteboardOperationErrorMessage(error: unknown): string {
  const rejection = getOperationRejection(error)

  if (rejection) {
    return rejection.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Whiteboard operation failed."
}

export function createToastId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createWhiteboardToast(
  message: string,
  variant: WhiteboardToastVariant,
): WhiteboardToast {
  return {
    id: createToastId(),
    message,
    variant,
    createdAt: Date.now(),
  }
}

export function appendWhiteboardToast(
  toasts: WhiteboardToast[],
  toast: WhiteboardToast,
): WhiteboardToast[] {
  return [...toasts, toast].slice(-maxToastCount)
}

export async function handleOperationFailure(
  error: unknown,
  get: () => WhiteboardState,
  set: (
    partial:
      | Partial<WhiteboardState>
      | ((state: WhiteboardState) => Partial<WhiteboardState>),
  ) => void,
) {
  const rejection = getOperationRejection(error)

  if (rejection) {
    get().applyOperationRejection(rejection)

    if (rejection.latestObject) {
      return
    }
  } else {
    set({
      mutationError: getWhiteboardOperationErrorMessage(error),
    })
  }

  await reloadObjectsSafely(get().roomId, get().setObjectsWithRevision)
}

export function handleUndoRedoOperationFailure(
  error: unknown,
  get: () => WhiteboardState,
  set: (
    partial:
      | Partial<WhiteboardState>
      | ((state: WhiteboardState) => Partial<WhiteboardState>),
  ) => void,
) {
  const rejection = getOperationRejection(error)

  if (rejection) {
    get().applyOperationRejection(rejection)
    return
  }

  set({
    mutationError: getWhiteboardOperationErrorMessage(error),
  })
}

export async function reloadObjectsSafely(
  roomId: string | null,
  setObjectsWithRevision: WhiteboardState["setObjectsWithRevision"],
) {
  if (!roomId) {
    return
  }

  try {
    const response = await getRoomObjects(roomId)
    setObjectsWithRevision(response.objects, response.currentRevision)
  } catch {
    // Keep original mutation error visible if reload also fails
  }
}
