"use client"

import type {
  ObjectMutablePatch,
  ObjectType,
  OnlineUser,
  OperationAppliedEvent,
  RoomRole,
  RoomStateEvent,
  ShapeStyle,
  Tool,
  UserSummary,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import { create } from "zustand"
import { readStoredGuestIdentity } from "@/features/identity/guest-identity"
import {
  createWhiteboardObject,
  deleteWhiteboardObject,
  getRoomObjects,
  getWhiteboardApiErrorMessage,
  updateWhiteboardObject,
} from "@/features/whiteboard/whiteboard-api"
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
  selectedObjectId: string | null
  currentTool: Tool
  toolRevision: number
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
  setObjects: (objects: WhiteboardObject[]) => void
  setObjectsWithRevision: (
    objects: WhiteboardObject[],
    currentRevision: number,
  ) => void
  upsertObject: (object: WhiteboardObject) => void
  applyOperationResult: (
    operation: OperationAppliedEvent,
    options?: { removeObjectId?: string },
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

const emptyStageSize: StageSize = {
  width: 0,
  height: 0,
}

const demoActorId = "00000000-0000-4000-8000-000000000401"
const localFallbackActorId = "00000000-0000-4000-8000-000000000402"
const demoTimestamp = "2026-06-06T00:00:00.000Z"
let mutationQueue = Promise.resolve()

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
  }

  return nextObjects
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
  selectedObjectId: null,
  currentTool: "SELECT",
  toolRevision: 0,
  viewport: initialViewport,
  stageSize: emptyStageSize,
  setRoomId: (roomId) =>
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
        selectedObjectId: null,
        currentTool: "SELECT",
        toolRevision: state.toolRevision + 1,
        viewport: getCenteredViewport(state.stageSize),
      }
    }),
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
  setLoadedRoomState: (input) =>
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
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
        currentTool: canEditRoom(input.currentUser.role)
          ? state.currentTool
          : "SELECT",
      }
    }),
  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
    }),
  setSocketError: (message) =>
    set({
      socketError: message,
    }),
  setOnlineUsers: (onlineUsers) =>
    set({
      onlineUsers,
    }),
  setMutationError: (message) =>
    set({
      mutationError: message,
    }),
  setObjects: (objects) =>
    set((state) => {
      const nextObjects = toObjectRecord(objects)
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        objects: nextObjects,
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    }),
  setObjectsWithRevision: (objects, currentRevision) =>
    set((state) => {
      const nextObjects = toObjectRecord(objects)
      const selectedObject = state.selectedObjectId
        ? nextObjects[state.selectedObjectId]
        : null

      return {
        objects: nextObjects,
        currentRevision,
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    }),
  upsertObject: (object) =>
    set((state) => ({
      objects: {
        ...state.objects,
        [object.id]: object,
      },
    })),
  applyOperationResult: (operation, options) =>
    set((state) => {
      if (state.roomId !== operation.roomId) {
        return state
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
        currentRevision: operation.revision,
        mutationError: null,
        selectedObjectId:
          selectedObject && !selectedObject.deletedAt
            ? state.selectedObjectId
            : null,
      }
    }),
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
        const operation = await updateWhiteboardObject(
          queuedState.roomId,
          objectId,
          {
            clientOpId: crypto.randomUUID(),
            baseRoomRevision: queuedState.currentRevision,
            baseObjectVersion: object.version,
            patch,
          },
        )

        get().applyOperationResult(operation)
      } catch (error) {
        set({
          mutationError: getWhiteboardApiErrorMessage(error),
        })
        await reloadObjectsSafely(get().roomId, get().setObjectsWithRevision)
      }
    })
  },
  removeObject: (objectId) =>
    set((state) => {
      const nextObjects = { ...state.objects }
      delete nextObjects[objectId]

      return {
        objects: nextObjects,
        selectedObjectId:
          state.selectedObjectId === objectId ? null : state.selectedObjectId,
      }
    }),
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

    set((currentState) => ({
      objects: {
        ...currentState.objects,
        [selectedObjectId]: {
          ...selectedObject,
          deletedAt: new Date().toISOString(),
        },
      },
      selectedObjectId: null,
    }))

    enqueueMutation(async () => {
      const queuedState = get()
      const object = queuedState.objects[selectedObjectId] ?? selectedObject

      if (!queuedState.roomId) {
        return
      }

      try {
        const operation = await deleteWhiteboardObject(
          queuedState.roomId,
          selectedObjectId,
          {
            clientOpId: crypto.randomUUID(),
            baseRoomRevision: queuedState.currentRevision,
            baseObjectVersion: object.version,
          },
        )

        get().applyOperationResult(operation)
      } catch (error) {
        set({
          mutationError: getWhiteboardApiErrorMessage(error),
        })
        await reloadObjectsSafely(get().roomId, get().setObjectsWithRevision)
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
        const operation = await createWhiteboardObject(queuedState.roomId, {
          clientOpId: crypto.randomUUID(),
          baseRoomRevision: queuedState.currentRevision,
          object: toCreateRequestObject(input, zIndex),
        })

        get().applyOperationResult(operation, {
          removeObjectId: object.id,
        })
      } catch (error) {
        set({
          mutationError: getWhiteboardApiErrorMessage(error),
        })
        await reloadObjectsSafely(get().roomId, get().setObjectsWithRevision)
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
