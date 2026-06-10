"use client"

import type {
  CursorUpdateRequest,
  CursorUpdatedEvent,
  ObjectCreateSocketRequest,
  ObjectDeleteSocketRequest,
  ObjectMutablePatch,
  ObjectTransformPreviewPatch,
  ObjectTransformPreviewRequest,
  ObjectTransformPreviewedEvent,
  ObjectType,
  ObjectUpdateSocketRequest,
  OnlineUser,
  OperationAppliedEvent,
  OperationRejectedEvent,
  RoomRole,
  RoomStateEvent,
  ShapeStyle,
  Tool,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import { create } from "zustand"
import { readStoredGuestIdentity } from "@/features/identity/guest-identity"
import { getRoomObjects } from "@/features/whiteboard/whiteboard-api"
import {
  clampViewport,
  clampScale,
  getCenteredViewport,
  initialViewport,
  panViewportBy,
  zoomViewportBy,
  type CanvasPoint,
  type StageSize,
  type Viewport,
} from "@/lib/canvas-utils"

type WhiteboardState = {
  roomId: string | null
  room: WhiteboardRoomState | null
  currentUser: WhiteboardCurrentUser | null
  currentRevision: number
  connectionStatus: ConnectionStatus
  socketError: string | null
  onlineUsers: OnlineUser[]
  mutationError: string | null
  objects: Record<string, WhiteboardObject>
  remoteCursors: Record<string, RemoteCursor>
  remoteTransformPreviews: Record<string, RemoteTransformPreview>
  appliedClientOpIds: Record<string, true>
  selectedObjectId: string | null
  currentTool: Tool
  toolRevision: number
  objectOperationSender: WhiteboardOperationSender | null
  transformPreviewSender: WhiteboardTransformPreviewSender | null
  cursorSender: WhiteboardCursorSender | null
  viewport: Viewport
  stageSize: StageSize
  setRoomId: (roomId: string) => void
  selectObject: (objectId: string | null) => void
  setTool: (tool: Tool) => void
  setLoadedRoomState: (input: LoadedRoomStateInput) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setSocketError: (message: string | null) => void
  setOnlineUsers: (onlineUsers: OnlineUser[]) => void
  setMutationError: (message: string | null) => void
  setObjectOperationSender: (sender: WhiteboardOperationSender | null) => void
  setTransformPreviewSender: (
    sender: WhiteboardTransformPreviewSender | null,
  ) => void
  setCursorSender: (sender: WhiteboardCursorSender | null) => void
  setObjects: (objects: WhiteboardObject[]) => void
  setObjectsWithRevision: (
    objects: WhiteboardObject[],
    currentRevision: number,
  ) => void
  upsertObject: (object: WhiteboardObject) => void
  applyOperation: (
    operation: OperationAppliedEvent,
    options?: { removeObjectId?: string },
  ) => void
  applyOperationRejection: (rejection: OperationRejectedEvent) => void
  applyRemoteTransformPreview: (
    event: ObjectTransformPreviewedEvent,
  ) => void
  applyRemoteCursor: (event: CursorUpdatedEvent) => void
  sendCursorUpdate: (point: CanvasPoint) => void
  clearRemoteTransformPreview: (objectId: string) => void
  sendTransformPreview: (
    objectId: string,
    preview: ObjectTransformPreviewPatch,
  ) => void
  updateObjectPatch: (
    objectId: string,
    patch: ObjectMutablePatch,
  ) => void
  removeObject: (objectId: string) => void
  deleteSelectedObject: () => void
  createLocalObject: (input: LocalObjectInput) => WhiteboardObject | null
  seedDemoObjects: (roomId: string) => void
  setStageSize: (stageSize: StageSize) => void
  setViewport: (viewport: Viewport) => void
  panViewportBy: (delta: CanvasPoint) => void
  zoomViewportBy: (factor: number, anchor?: CanvasPoint) => void
  resetViewport: () => void
}

type WhiteboardCurrentUser = UserSummary & {
  role: RoomRole
}

type WhiteboardRoomState = RoomStateEvent["room"]

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected"

type LoadedRoomStateInput = {
  room: WhiteboardRoomState
  currentUser: WhiteboardCurrentUser
  currentRevision: number
  objects: WhiteboardObject[]
  onlineUsers?: OnlineUser[]
}

export type RemoteTransformPreview = {
  roomId: string
  objectId: string
  user: UserSummary
  preview: ObjectTransformPreviewPatch
  timestamp: string
  receivedAt: number
}

export type RemoteCursor = CursorUpdatedEvent & {
  receivedAt: number
}

export type LocalObjectInput = {
  type: ObjectType
  x: number
  y: number
  width?: number
  height?: number
  points?: number[]
  text?: string
  rotation?: number
  style: ShapeStyle
}

export type WhiteboardOperationSender = {
  createObject: (
    request: ObjectCreateSocketRequest,
    options?: { tempObjectId?: string },
  ) => Promise<OperationAppliedEvent>
  updateObject: (
    request: ObjectUpdateSocketRequest,
  ) => Promise<OperationAppliedEvent>
  deleteObject: (
    request: ObjectDeleteSocketRequest,
  ) => Promise<OperationAppliedEvent>
}

export type WhiteboardTransformPreviewSender = {
  sendPreview: (request: ObjectTransformPreviewRequest) => void
}

export type WhiteboardCursorSender = {
  sendCursorUpdate: (request: CursorUpdateRequest) => void
}

const emptyStageSize: StageSize = {
  width: 0,
  height: 0,
}

const remoteTransformPreviewStaleMs = 1500
const demoActorId = "00000000-0000-4000-8000-000000000401"
const localFallbackActorId = "00000000-0000-4000-8000-000000000402"
const demoTimestamp = "2026-06-06T00:00:00.000Z"
let mutationQueue = Promise.resolve()
const remoteTransformPreviewTimeouts = new Map<
  string,
  ReturnType<typeof setTimeout>
>()

function normalizeStageSize(stageSize: StageSize): StageSize {
  return {
    width: Math.max(0, Math.floor(stageSize.width)),
    height: Math.max(0, Math.floor(stageSize.height)),
  }
}

function normalizeViewport(viewport: Viewport): Viewport {
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : initialViewport.x,
    y: Number.isFinite(viewport.y) ? viewport.y : initialViewport.y,
    scale: clampScale(viewport.scale),
  }
}

function getStageCenter(stageSize: StageSize): CanvasPoint {
  return {
    x: stageSize.width / 2,
    y: stageSize.height / 2,
  }
}

function toObjectRecord(
  objects: WhiteboardObject[],
): Record<string, WhiteboardObject> {
  return Object.fromEntries(objects.map((object) => [object.id, object]))
}

function getNextZIndex(objects: Record<string, WhiteboardObject>): number {
  const maxZIndex = Object.values(objects)
    .filter((object) => !object.deletedAt)
    .reduce((max, object) => Math.max(max, object.zIndex), 0)

  return maxZIndex + 10
}

function clearRemotePreviewTimeout(objectId: string | null | undefined) {
  if (!objectId) {
    return
  }

  const timeout = remoteTransformPreviewTimeouts.get(objectId)

  if (!timeout) {
    return
  }

  clearTimeout(timeout)
  remoteTransformPreviewTimeouts.delete(objectId)
}

function clearAllRemotePreviewTimeouts() {
  for (const timeout of remoteTransformPreviewTimeouts.values()) {
    clearTimeout(timeout)
  }

  remoteTransformPreviewTimeouts.clear()
}

function scheduleRemotePreviewTimeout(
  objectId: string,
  clearRemoteTransformPreview: (targetObjectId: string) => void,
) {
  clearRemotePreviewTimeout(objectId)

  const timeout = setTimeout(() => {
    remoteTransformPreviewTimeouts.delete(objectId)
    clearRemoteTransformPreview(objectId)
  }, remoteTransformPreviewStaleMs)

  remoteTransformPreviewTimeouts.set(objectId, timeout)
}

function removeRemoteTransformPreviews(
  previews: Record<string, RemoteTransformPreview>,
  objectIds: Array<string | null | undefined>,
): Record<string, RemoteTransformPreview> {
  const targetObjectIds = objectIds.filter(
    (objectId): objectId is string => Boolean(objectId),
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

function pruneRemoteCursors(
  cursors: Record<string, RemoteCursor>,
  onlineUsers: OnlineUser[],
  currentUserId: string | null | undefined,
): Record<string, RemoteCursor> {
  const onlineUserIds = new Set(onlineUsers.map((user) => user.id))
  let nextCursors = cursors

  for (const userId of Object.keys(cursors)) {
    if (userId !== currentUserId && onlineUserIds.has(userId)) {
      continue
    }

    if (nextCursors === cursors) {
      nextCursors = { ...cursors }
    }

    delete nextCursors[userId]
  }

  return nextCursors
}

function getLocalActorId(): string {
  return readStoredGuestIdentity()?.id ?? localFallbackActorId
}

function canEditRoom(role: RoomRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR"
}

function enqueueMutation(task: () => Promise<void>) {
  mutationQueue = mutationQueue.then(task, task)
  void mutationQueue.catch(() => undefined)
}

function applyOperationToObjects(
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

function getMonotonicRevision(
  currentRevision: number,
  nextRevision: number | undefined,
): number {
  return nextRevision === undefined
    ? currentRevision
    : Math.max(currentRevision, nextRevision)
}

function toCreateRequestObject(input: LocalObjectInput, zIndex: number) {
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

function getOperationRejection(error: unknown): OperationRejectedEvent | null {
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

function getWhiteboardOperationErrorMessage(error: unknown): string {
  const rejection = getOperationRejection(error)

  if (rejection) {
    return rejection.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Whiteboard operation failed."
}

async function handleOperationFailure(
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

async function reloadObjectsSafely(
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
    // Keep the original mutation error visible if reload also fails.
  }
}

function createLocalObjectRecord(
  roomId: string,
  input: LocalObjectInput,
  zIndex: number,
): WhiteboardObject {
  const timestamp = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    roomId,
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    points: input.points,
    text: input.text,
    rotation: input.rotation ?? 0,
    style: input.style,
    zIndex,
    version: 1,
    createdById: getLocalActorId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createDemoObjects(roomId: string): WhiteboardObject[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000501",
      roomId,
      type: "RECTANGLE",
      x: 9780,
      y: 9820,
      width: 260,
      height: 150,
      rotation: 0,
      style: {
        fill: "rgba(134, 239, 172, 0.18)",
        stroke: "#14532d",
        strokeWidth: 3,
        opacity: 1,
      },
      zIndex: 10,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
    },
    {
      id: "00000000-0000-4000-8000-000000000502",
      roomId,
      type: "CIRCLE",
      x: 10130,
      y: 9840,
      width: 180,
      height: 120,
      rotation: 0,
      style: {
        fill: "rgba(243, 220, 164, 0.28)",
        stroke: "#533707",
        strokeWidth: 3,
        opacity: 1,
      },
      zIndex: 20,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
    },
    {
      id: "00000000-0000-4000-8000-000000000503",
      roomId,
      type: "LINE",
      x: 10010,
      y: 10100,
      points: [0, 0, 300, -120],
      rotation: 0,
      style: {
        stroke: "#14532d",
        strokeWidth: 5,
        opacity: 1,
        arrowEnd: true,
      },
      zIndex: 30,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
    },
    {
      id: "00000000-0000-4000-8000-000000000504",
      roomId,
      type: "TEXT",
      x: 9760,
      y: 10120,
      width: 330,
      height: 84,
      text: "Objective Alpha",
      rotation: 0,
      style: {
        color: "#172018",
        fontSize: 30,
        fontFamily: "sans-serif",
        fontWeight: "bold",
        opacity: 1,
      },
      zIndex: 40,
      version: 1,
      createdById: demoActorId,
      createdAt: demoTimestamp,
      updatedAt: demoTimestamp,
    },
  ]
}

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  roomId: null,
  room: null,
  currentUser: null,
  currentRevision: 0,
  connectionStatus: "idle",
  socketError: null,
  onlineUsers: [],
  mutationError: null,
  objects: {},
  remoteCursors: {},
  remoteTransformPreviews: {},
  appliedClientOpIds: {},
  selectedObjectId: null,
  currentTool: "SELECT",
  toolRevision: 0,
  objectOperationSender: null,
  transformPreviewSender: null,
  cursorSender: null,
  viewport: initialViewport,
  stageSize: emptyStageSize,
  setRoomId: (roomId) => {
    if (get().roomId !== roomId) {
      clearAllRemotePreviewTimeouts()
    }

    set((state) => {
      if (state.roomId === roomId) {
        return state
      }

      return {
        roomId,
        room: null,
        currentUser: null,
        currentRevision: 0,
        connectionStatus: "idle",
        socketError: null,
        onlineUsers: [],
        mutationError: null,
        objects: {},
        remoteCursors: {},
        remoteTransformPreviews: {},
        appliedClientOpIds: {},
        selectedObjectId: null,
        currentTool: "SELECT",
        toolRevision: state.toolRevision + 1,
        objectOperationSender: null,
        transformPreviewSender: null,
        cursorSender: null,
        viewport: getCenteredViewport(state.stageSize),
      }
    })
  },
  selectObject: (objectId) =>
    set((state) => {
      if (!objectId) {
        return state.selectedObjectId === null
          ? state
          : { selectedObjectId: null }
      }

      const object = state.objects[objectId]

      if (!object || object.deletedAt || state.selectedObjectId === objectId) {
        return state
      }

      return { selectedObjectId: objectId }
    }),
  setTool: (tool) =>
    set((state) =>
      state.currentTool === tool
        ? state
        : {
            currentTool: tool,
            toolRevision: state.toolRevision + 1,
          },
    ),
  setLoadedRoomState: (input) => {
    clearAllRemotePreviewTimeouts()

    set((state) => {
      const nextObjects = toObjectRecord(input.objects)
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        roomId: input.room.id,
        room: input.room,
        currentUser: input.currentUser,
        currentRevision: input.currentRevision,
        connectionStatus: "connected",
        socketError: null,
        onlineUsers: input.onlineUsers ?? state.onlineUsers,
        mutationError: null,
        objects: nextObjects,
        remoteCursors: {},
        remoteTransformPreviews: {},
        appliedClientOpIds: {},
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
        currentTool: canEditRoom(input.currentUser.role)
          ? state.currentTool
          : "SELECT",
      }
    })
  },
  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
    }),
  setSocketError: (message) =>
    set({
      socketError: message,
    }),
  setOnlineUsers: (onlineUsers) =>
    set((state) => ({
      onlineUsers,
      remoteCursors: pruneRemoteCursors(
        state.remoteCursors,
        onlineUsers,
        state.currentUser?.id,
      ),
    })),
  setMutationError: (message) =>
    set({
      mutationError: message,
    }),
  setObjectOperationSender: (sender) =>
    set({
      objectOperationSender: sender,
    }),
  setTransformPreviewSender: (sender) =>
    set({
      transformPreviewSender: sender,
    }),
  setCursorSender: (sender) =>
    set({
      cursorSender: sender,
    }),
  setObjects: (objects) => {
    clearAllRemotePreviewTimeouts()

    set((state) => {
      const nextObjects = toObjectRecord(objects)
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        objects: nextObjects,
        remoteTransformPreviews: {},
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    })
  },
  setObjectsWithRevision: (objects, currentRevision) => {
    clearAllRemotePreviewTimeouts()

    set((state) => {
      const nextObjects = toObjectRecord(objects)
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        objects: nextObjects,
        remoteTransformPreviews: {},
        currentRevision,
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    })
  },
  upsertObject: (object) =>
    set((state) => ({
      objects: {
        ...state.objects,
        [object.id]: object,
      },
    })),
  applyOperation: (operation, options) => {
    clearRemotePreviewTimeout(operation.objectId ?? undefined)
    clearRemotePreviewTimeout(operation.resultingObject?.id)

    set((state) => {
      if (state.roomId !== operation.roomId) {
        return state
      }

      const nextRemoteTransformPreviews = removeRemoteTransformPreviews(
        state.remoteTransformPreviews,
        [operation.objectId, operation.resultingObject?.id],
      )

      if (
        state.appliedClientOpIds[operation.clientOpId] ||
        operation.revision <= state.currentRevision
      ) {
        return nextRemoteTransformPreviews === state.remoteTransformPreviews
          ? state
          : {
              remoteTransformPreviews: nextRemoteTransformPreviews,
            }
      }

      const nextObjects = applyOperationToObjects(
        state.objects,
        operation,
        options?.removeObjectId,
      )
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        objects: nextObjects,
        appliedClientOpIds: {
          ...state.appliedClientOpIds,
          [operation.clientOpId]: true,
        },
        currentRevision: operation.revision,
        mutationError: null,
        remoteTransformPreviews: nextRemoteTransformPreviews,
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    })
  },
  applyOperationRejection: (rejection) =>
    set((state) => {
      if (state.roomId !== rejection.roomId) {
        return state
      }

      if (!rejection.latestObject) {
        return {
          mutationError: rejection.message,
          currentRevision: getMonotonicRevision(
            state.currentRevision,
            rejection.currentRoomRevision,
          ),
        }
      }

      const nextObjects = {
        ...state.objects,
        [rejection.latestObject.id]: rejection.latestObject,
      }
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        objects: nextObjects,
        currentRevision: getMonotonicRevision(
          state.currentRevision,
          rejection.currentRoomRevision,
        ),
        mutationError: rejection.message,
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    }),
  applyRemoteTransformPreview: (event) => {
    const state = get()

    if (state.roomId !== event.roomId) {
      return
    }

    const object = state.objects[event.objectId]

    if (!object || object.deletedAt) {
      return
    }

    set((currentState) => {
      if (currentState.roomId !== event.roomId) {
        return currentState
      }

      const currentObject = currentState.objects[event.objectId]

      if (!currentObject || currentObject.deletedAt) {
        return currentState
      }

      return {
        remoteTransformPreviews: {
          ...currentState.remoteTransformPreviews,
          [event.objectId]: {
            ...event,
            receivedAt: Date.now(),
          },
        },
      }
    })

    scheduleRemotePreviewTimeout(
      event.objectId,
      get().clearRemoteTransformPreview,
    )
  },
  applyRemoteCursor: (event) =>
    set((state) => {
      if (
        state.roomId !== event.roomId ||
        state.currentUser?.id === event.user.id
      ) {
        return state
      }

      return {
        remoteCursors: {
          ...state.remoteCursors,
          [event.user.id]: {
            ...event,
            receivedAt: Date.now(),
          },
        },
      }
    }),
  sendCursorUpdate: (point) => {
    const state = get()

    if (!state.roomId || !state.cursorSender) {
      return
    }

    state.cursorSender.sendCursorUpdate({
      roomId: state.roomId,
      x: point.x,
      y: point.y,
      selectedObjectId: state.selectedObjectId,
      currentTool: state.currentTool,
    })
  },
  clearRemoteTransformPreview: (objectId) => {
    clearRemotePreviewTimeout(objectId)

    set((state) => {
      if (!(objectId in state.remoteTransformPreviews)) {
        return state
      }

      const nextRemoteTransformPreviews = {
        ...state.remoteTransformPreviews,
      }
      delete nextRemoteTransformPreviews[objectId]

      return {
        remoteTransformPreviews: nextRemoteTransformPreviews,
      }
    })
  },
  sendTransformPreview: (objectId, preview) => {
    const state = get()
    const object = state.objects[objectId]

    if (
      !state.roomId ||
      !state.transformPreviewSender ||
      !canEditRoom(state.currentUser?.role) ||
      !object ||
      object.deletedAt
    ) {
      return
    }

    state.transformPreviewSender.sendPreview({
      roomId: state.roomId,
      objectId,
      preview,
    })
  },
  updateObjectPatch: (objectId, patch) => {
    const state = get()

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot edit whiteboard objects.",
      })
      return
    }

    set((currentState) => {
      const object = currentState.objects[objectId]

      if (!object || object.deletedAt) {
        return currentState
      }

      return {
        objects: {
          ...currentState.objects,
          [objectId]: {
            ...object,
            ...patch,
            style: patch.style
              ? {
                  ...object.style,
                  ...patch.style,
                }
              : object.style,
          },
        },
      }
    })

    enqueueMutation(async () => {
      const queuedState = get()
      const object = queuedState.objects[objectId]

      if (!queuedState.roomId || !object || object.deletedAt) {
        return
      }

      try {
        const sender = queuedState.objectOperationSender

        if (!sender) {
          throw new Error("Realtime connection is not ready.")
        }

        await sender.updateObject({
          roomId: queuedState.roomId,
          objectId,
          clientOpId: crypto.randomUUID(),
          baseRoomRevision: queuedState.currentRevision,
          baseObjectVersion: object.version,
          patch,
        })
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })
  },
  removeObject: (objectId) => {
    clearRemotePreviewTimeout(objectId)

    set((state) => {
      const nextObjects = { ...state.objects }
      const nextRemoteTransformPreviews = {
        ...state.remoteTransformPreviews,
      }
      delete nextObjects[objectId]
      delete nextRemoteTransformPreviews[objectId]

      return {
        objects: nextObjects,
        remoteTransformPreviews: nextRemoteTransformPreviews,
        selectedObjectId:
          state.selectedObjectId === objectId ? null : state.selectedObjectId,
      }
    })
  },
  deleteSelectedObject: () => {
    const state = get()
    const selectedObjectId = state.selectedObjectId

    if (!selectedObjectId) {
      return
    }

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot delete whiteboard objects.",
      })
      return
    }

    const selectedObject = state.objects[selectedObjectId]

    if (!selectedObject || selectedObject.deletedAt) {
      set({
        selectedObjectId: null,
      })
      return
    }

    clearRemotePreviewTimeout(selectedObjectId)

    set((currentState) => ({
      objects: {
        ...currentState.objects,
        [selectedObjectId]: {
          ...selectedObject,
          deletedAt: new Date().toISOString(),
        },
      },
      remoteTransformPreviews: removeRemoteTransformPreviews(
        currentState.remoteTransformPreviews,
        [selectedObjectId],
      ),
      selectedObjectId: null,
    }))

    enqueueMutation(async () => {
      const queuedState = get()
      const object = queuedState.objects[selectedObjectId] ?? selectedObject

      if (!queuedState.roomId) {
        return
      }

      try {
        const sender = queuedState.objectOperationSender

        if (!sender) {
          throw new Error("Realtime connection is not ready.")
        }

        await sender.deleteObject({
          roomId: queuedState.roomId,
          objectId: selectedObjectId,
          clientOpId: crypto.randomUUID(),
          baseRoomRevision: queuedState.currentRevision,
          baseObjectVersion: object.version,
        })
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })
  },
  createLocalObject: (input) => {
    const state = get()

    if (!state.roomId) {
      return null
    }

    if (!canEditRoom(state.currentUser?.role)) {
      set({
        mutationError: "Viewers cannot create whiteboard objects.",
      })
      return null
    }

    const zIndex = getNextZIndex(state.objects)
    const object = createLocalObjectRecord(
      state.roomId,
      input,
      zIndex,
    )

    set((currentState) => ({
      objects: {
        ...currentState.objects,
        [object.id]: object,
      },
    }))

    enqueueMutation(async () => {
      const queuedState = get()

      if (!queuedState.roomId) {
        return
      }

      try {
        const sender = queuedState.objectOperationSender
        const clientOpId = crypto.randomUUID()

        if (!sender) {
          throw new Error("Realtime connection is not ready.")
        }

        await sender.createObject({
          roomId: queuedState.roomId,
          clientOpId,
          baseRoomRevision: queuedState.currentRevision,
          object: toCreateRequestObject(input, zIndex),
        }, {
          tempObjectId: object.id,
        })
      } catch (error) {
        await handleOperationFailure(error, get, set)
      }
    })

    return object
  },
  seedDemoObjects: (roomId) =>
    set((state) => {
      const hasRoomObjects = Object.values(state.objects).some(
        (object) => object.roomId === roomId && !object.deletedAt,
      )

      if (hasRoomObjects) {
        return state
      }

      return {
        objects: toObjectRecord(createDemoObjects(roomId)),
      }
    }),
  setStageSize: (stageSize) =>
    set((state) => {
      const nextStageSize = normalizeStageSize(stageSize)
      const shouldCenterViewport =
        state.stageSize.width === 0 || state.stageSize.height === 0

      return {
        stageSize: nextStageSize,
        viewport: shouldCenterViewport
          ? getCenteredViewport(nextStageSize)
          : clampViewport(state.viewport, nextStageSize),
      }
    }),
  setViewport: (viewport) =>
    set((state) => ({
      viewport: clampViewport(normalizeViewport(viewport), state.stageSize),
    })),
  panViewportBy: (delta) =>
    set((state) => ({
      viewport: panViewportBy(state.viewport, delta, state.stageSize),
    })),
  zoomViewportBy: (factor, anchor) =>
    set((state) => ({
      viewport: zoomViewportBy(
        state.viewport,
        factor,
        anchor ?? getStageCenter(state.stageSize),
        state.stageSize,
      ),
    })),
  resetViewport: () =>
    set((state) => ({
      viewport: getCenteredViewport(state.stageSize),
    })),
}))
