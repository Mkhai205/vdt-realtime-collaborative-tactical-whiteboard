# 07. WebSocket Event Contract

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 — Software Engineer Track  
**Document version:** v0.1  
**Status:** Draft  

---

## 1. Purpose

This document defines the WebSocket event contract between the frontend and backend for the **Realtime Collaborative Tactical Whiteboard** project.

The contract specifies:

- Event names
- Direction
- Request payloads
- Response/broadcast payloads
- Permission rules
- Error cases

All WebSocket payloads should be validated using shared Zod schemas in `packages/shared-contracts`.

---

## 2. Naming Convention

Event names use kebab/camel-like namespace format:

```txt
domain:action
```

Examples:

```txt
room:join
object:create
operation:applied
sync:request
cursor:update
selection:update
```

---

## 3. Event Direction Legend

| Direction | Meaning |
|---|---|
| Client -> Server | Client emits event to backend. |
| Server -> Client | Server emits event to one client. |
| Server -> Room | Server broadcasts event to all or other clients in a room. |

---

## 4. Common Types

## 4.1 User summary

```ts
type UserSummary = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
};
```

---

## 4.2 Room role

```ts
type RoomRole = "OWNER" | "EDITOR" | "VIEWER";
```

---

## 4.3 Tool

```ts
type Tool = "SELECT" | "HAND" | "RECTANGLE" | "CIRCLE" | "LINE" | "TEXT";
```

---

## 4.4 Whiteboard object

```ts
type WhiteboardObject = {
  id: string;
  roomId: string;
  type: "RECTANGLE" | "CIRCLE" | "LINE" | "TEXT";
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  points?: number[] | null;
  text?: string | null;
  rotation: number;
  style: ShapeStyle;
  zIndex: number;
  version: number;
  createdById: string;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};
```

---

## 4.5 Shape style

```ts
type ShapeStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  color?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;
};
```

---

## 4.6 Object mutable patch

```ts
type ObjectMutablePatch = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[];
  text: string;
  rotation: number;
  style: ShapeStyle;
  zIndex: number;
}>;
```

Only mutable canvas fields are allowed in object update patches.

---

## 4.7 Operation applied event

```ts
type OperationAppliedEvent = {
  operationId: string;
  clientOpId: string;
  roomId: string;
  revision: number;
  type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE" | "OBJECT_RESTORE";
  objectId?: string | null;
  actor: UserSummary;
  payload: unknown;
  resultingObject?: WhiteboardObject | null;
  createdAt: string;
};
```

---

## 4.8 Operation rejected event

```ts
type OperationRejectedEvent = {
  clientOpId: string;
  roomId: string;
  reason:
    | "PERMISSION_DENIED"
    | "ROOM_NOT_FOUND"
    | "USER_NOT_IN_ROOM"
    | "OBJECT_NOT_FOUND"
    | "OBJECT_ALREADY_DELETED"
    | "OBJECT_VERSION_CONFLICT"
    | "INVALID_OPERATION_PAYLOAD"
    | "DUPLICATE_OPERATION"
    | "INTERNAL_ERROR";
  message: string;
  latestObject?: WhiteboardObject | null;
  currentRoomRevision?: number;
};
```

---

## 4.9 Revision serialization

```txt
Database revisions are stored as BigInt.
REST and WebSocket contracts expose revision values as number for the MVP.
The backend must convert Prisma BigInt values before returning JSON.
The MVP assumes revisions stay within JavaScript's safe integer range.
```

---

## 5. Connection Authentication

The socket handshake supports the same identity precedence as REST. JWT token
auth takes precedence over guest identity. The actual Socket.IO gateway is
implemented later, but clients should prepare this auth payload now.

Recommended handshake:

```ts
type SocketAuthPayload = {
  // Raw JWT access token, without the "Bearer " prefix.
  token?: string;
  guestName?: string;
  guestId?: string;
  guestAvatarColor?: string;
};
```

Rules:

```txt
- If JWT token is provided, server resolves authenticated user.
- If JWT token is provided but invalid, server rejects the connection and does not fall back to guest identity.
- If guestName is provided, server creates/resolves guest identity.
- If neither is valid, connection is rejected.
- Frontend sends auth.token from localStorage key rctw.authToken.v1 when present; otherwise it sends guestId, guestName, and guestAvatarColor.
```

---

## 6. Event Summary

| Event | Direction | Persisted | Description |
|---|---|---:|---|
| room:join | Client -> Server | No | Join a whiteboard room. |
| room:leave | Client -> Server | No | Leave a whiteboard room. |
| room:state | Server -> Client | No | Initial/current room state. |
| presence:update | Server -> Room | No | Online user list changed. |
| selection:update | Client -> Server | No | Update selected object presence. |
| cursor:update | Client -> Server | No | Update cursor position. |
| cursor:updated | Server -> Room | No | Broadcast remote cursor position. |
| object:create | Client -> Server | Yes | Create object. |
| object:update | Client -> Server | Yes | Update object. |
| object:delete | Client -> Server | Yes | Delete object. |
| operation:applied | Server -> Room | Yes | Broadcast accepted operation. |
| operation:rejected | Server -> Client | No | Operation rejected. |
| sync:request | Client -> Server | No | Request missed state after reconnect. |
| sync:response | Server -> Client | No | Return operations or full state. |
| editing:start | Client -> Server | No | User starts editing object. |
| editing:end | Client -> Server | No | User stops editing object. |
| object:editing | Server -> Room | No | Broadcast editing indicator. |
| object:transform-preview | Client -> Server | No | Should-have realtime transform preview. |
| object:transform-previewed | Server -> Room | No | Broadcast transform preview. |
| undo:request | Client -> Server | Yes | Should-have undo request. |
| redo:request | Client -> Server | Yes | Should-have redo request. |
| error | Server -> Client | No | Generic socket error. |

---

# 7. Room Events

## 7.1 `room:join`

### Direction

```txt
Client -> Server
```

### Description

Join a whiteboard room and receive current room state.

### Payload

```ts
type RoomJoinRequest = {
  roomId: string;
};
```

### Permission

```txt
- Public room: user can join by link.
- Private room: user must already be a member.
```

### Server response

Server emits `room:state` to the joining client.

Server broadcasts `presence:update` to other clients in the room.

---

## 7.2 `room:state`

### Direction

```txt
Server -> Client
```

### Payload

```ts
type RoomStateEvent = {
  room: {
    id: string;
    name: string;
    description?: string | null;
    currentRevision: number;
    isPublic: boolean;
    defaultJoinRole: "EDITOR" | "VIEWER";
  };
  currentUser: UserSummary & {
    role: RoomRole;
  };
  objects: WhiteboardObject[];
  onlineUsers: OnlineUser[];
};
```

### Client behavior

```txt
- Replace local room state.
- Replace local objects.
- Set lastSeenRevision = room.currentRevision.
- Render online users and cursors.
```

---

## 7.3 `room:leave`

### Direction

```txt
Client -> Server
```

### Payload

```ts
type RoomLeaveRequest = {
  roomId: string;
};
```

### Server behavior

```txt
- Remove socket from Socket.IO room.
- Update in-memory presence.
- Broadcast presence:update.
```

---

## 7.4 `presence:update`

### Direction

```txt
Server -> Room
```

### Payload

```ts
type OnlineUser = UserSummary & {
  role: RoomRole;
  status: "ONLINE";
  selectedObjectId?: string | null;
  connectedAt: string;
};

type PresenceUpdateEvent = {
  roomId: string;
  onlineUsers: OnlineUser[];
};
```

---

# 8. Cursor Events

## 8.0 `selection:update`

### Direction

```txt
Client -> Server
```

### Description

Send the current selected object id for presence display. This event is transient, updates in-memory presence only, and does not imply editing or locking.

### Payload

```ts
type SelectionUpdateRequest = {
  roomId: string;
  selectedObjectId: string | null;
};
```

### Server behavior

```txt
- Validate user is in room.
- Update in-memory presence for the socket.
- Broadcast presence:update to the room.
- Do not persist.
- Do not increment room revision.
```

## 8.1 `cursor:update`

### Direction

```txt
Client -> Server
```

### Description

Send current cursor position on the canvas.

### Payload

```ts
type CursorUpdateRequest = {
  roomId: string;
  x: number;
  y: number;
  selectedObjectId?: string | null;
  currentTool?: Tool;
};
```

### Frequency rule

```txt
Client should throttle this event to 30-50ms.
```

### Persistence

```txt
Not persisted.
Does not increment room revision.
```

---

## 8.2 `cursor:updated`

### Direction

```txt
Server -> Room, excluding sender
```

### Payload

```ts
type CursorUpdatedEvent = {
  roomId: string;
  user: UserSummary;
  x: number;
  y: number;
  selectedObjectId?: string | null;
  currentTool?: Tool;
  timestamp: string;
};
```

---

# 9. Object Operation Events

## 9.1 `object:create`

### Direction

```txt
Client -> Server
```

### Description

Create a new whiteboard object.

### Payload

```ts
type ObjectCreateRequest = {
  clientOpId: string;
  roomId: string;
  baseRoomRevision?: number;
  object: {
    type: "RECTANGLE" | "CIRCLE" | "LINE" | "TEXT";
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: number[];
    text?: string;
    rotation?: number;
    style?: ShapeStyle;
    zIndex?: number;
  };
};
```

### Permission

```txt
OWNER or EDITOR only.
VIEWER is rejected.
```

### Success

Server broadcasts `operation:applied` to the room.

### Error

Server emits `operation:rejected` to sender.

---

## 9.2 `object:update`

### Direction

```txt
Client -> Server
```

### Description

Update object position, size, rotation, style, text, zIndex, or points.

### Payload

```ts
type ObjectUpdateRequest = {
  clientOpId: string;
  roomId: string;
  objectId: string;
  baseRoomRevision?: number;
  baseObjectVersion: number;
  patch: ObjectMutablePatch;
};
```

### Permission

```txt
OWNER or EDITOR only.
VIEWER is rejected.
```

### Success

Server broadcasts `operation:applied`.

### Error cases

```txt
PERMISSION_DENIED
OBJECT_NOT_FOUND
OBJECT_ALREADY_DELETED
OBJECT_VERSION_CONFLICT
INVALID_OPERATION_PAYLOAD
DUPLICATE_OPERATION
```

---

## 9.3 `object:delete`

### Direction

```txt
Client -> Server
```

### Description

Soft delete an object.

### Payload

```ts
type ObjectDeleteRequest = {
  clientOpId: string;
  roomId: string;
  objectId: string;
  baseRoomRevision?: number;
  baseObjectVersion: number;
};
```

### Permission

```txt
OWNER or EDITOR only.
```

### Success

Server broadcasts `operation:applied`.

---

## 9.4 Restore operation payload

`OBJECT_RESTORE` is a should-have operation used by undo/redo when restoring a soft-deleted object. It is not required as a standalone MVP event.

```ts
type ObjectRestoreRequest = {
  objectId: string;
  baseObjectVersion: number;
};
```

Server behavior:

```txt
1. Validate user is owner/editor.
2. Load object by objectId and roomId, including soft-deleted objects.
3. Reject if object does not exist.
4. Reject if baseObjectVersion does not match current object.version.
5. Set deletedAt to null.
6. Increment object version.
7. Increment room revision.
8. Store operation log as OBJECT_RESTORE.
9. Broadcast operation:applied.
```

---

## 9.5 `operation:applied`

### Direction

```txt
Server -> Room
```

### Description

Broadcast an accepted persistent operation.

### Payload

```ts
type OperationAppliedEvent = {
  operationId: string;
  clientOpId: string;
  roomId: string;
  revision: number;
  type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE" | "OBJECT_RESTORE";
  objectId?: string | null;
  actor: UserSummary;
  payload: unknown;
  resultingObject?: WhiteboardObject | null;
  createdAt: string;
};
```

### Client behavior

```txt
- Apply operation to local object state.
- Update lastSeenRevision = revision.
- Clear pending state if clientOpId matches local pending operation.
```

---

## 9.6 `operation:rejected`

### Direction

```txt
Server -> Client
```

### Description

Notify sender that an operation was rejected.

### Payload

```ts
type OperationRejectedEvent = {
  clientOpId: string;
  roomId: string;
  reason:
    | "PERMISSION_DENIED"
    | "ROOM_NOT_FOUND"
    | "USER_NOT_IN_ROOM"
    | "OBJECT_NOT_FOUND"
    | "OBJECT_ALREADY_DELETED"
    | "OBJECT_VERSION_CONFLICT"
    | "INVALID_OPERATION_PAYLOAD"
    | "DUPLICATE_OPERATION"
    | "INTERNAL_ERROR";
  message: string;
  latestObject?: WhiteboardObject | null;
  currentRoomRevision?: number;
};
```

### Client behavior

```txt
- Show toast.
- If latestObject exists, update local state.
- Clear pending operation.
```

---

# 10. Sync Events

## 10.1 `sync:request`

### Direction

```txt
Client -> Server
```

### Description

Request missed operations or full state after reconnect.

### Payload

```ts
type SyncRequest = {
  roomId: string;
  lastSeenRevision: number;
};
```

### Permission

User must have room access.

---

## 10.2 `sync:response`

### Direction

```txt
Server -> Client
```

### Payload

```ts
type SyncResponse =
  | {
      mode: "OPERATIONS";
      roomId: string;
      fromRevision: number;
      toRevision: number;
      operations: OperationAppliedEvent[];
    }
  | {
      mode: "FULL_STATE";
      roomId: string;
      revision: number;
      objects: WhiteboardObject[];
    };
```

### Client behavior

```txt
If mode = OPERATIONS:
- Apply operations in ascending revision order.
- Set lastSeenRevision = toRevision.

If mode = FULL_STATE:
- Replace local object state.
- Set lastSeenRevision = revision.
```

---

# 11. Editing Indicator Events

## 11.1 `editing:start`

### Direction

```txt
Client -> Server
```

### Description

Announce that the user started an active edit, such as dragging, resizing, rotating, or editing object fields. Plain selection stays on `selection:update` and does not imply editing.

### Payload

```ts
type EditingStartRequest = {
  roomId: string;
  objectId: string;
};
```

### Persistence

```txt
Not persisted.
Does not increment revision.
```

---

## 11.2 `editing:end`

### Direction

```txt
Client -> Server
```

### Payload

```ts
type EditingEndRequest = {
  roomId: string;
  objectId: string;
};
```

---

## 11.3 `object:editing`

### Direction

```txt
Server -> Room, excluding sender
```

### Payload

```ts
type ObjectEditingEvent = {
  roomId: string;
  objectId: string;
  user: UserSummary;
  status: "STARTED" | "ENDED";
  timestamp: string;
};
```

---

# 12. Transform Preview Events

Should-have feature.

## 12.1 `object:transform-preview`

### Direction

```txt
Client -> Server
```

### Payload

```ts
type ObjectTransformPreviewRequest = {
  roomId: string;
  objectId: string;
  preview: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    points?: number[];
  };
};
```

### Rule

```txt
- Not persisted.
- No revision increment.
- Should be throttled.
```

---

## 12.2 `object:transform-previewed`

### Direction

```txt
Server -> Room, excluding sender
```

### Payload

```ts
type ObjectTransformPreviewedEvent = {
  roomId: string;
  objectId: string;
  user: UserSummary;
  preview: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    points?: number[];
  };
  timestamp: string;
};
```

---

# 13. Undo/Redo Events

Should-have feature.

## 13.1 `undo:request`

### Direction

```txt
Client -> Server
```

### Description

Send an inverse operation from the client's undo stack.

### Payload

```ts
type UndoRequest = {
  clientOpId: string;
  roomId: string;
  inverseOperation: UndoRedoOperation;
};

type UndoRedoOperation =
  | ({ type: "OBJECT_CREATE" } & Pick<ObjectCreateRequest, "object">)
  | ({ type: "OBJECT_UPDATE"; objectId: string } & Pick<ObjectUpdateRequest, "baseObjectVersion" | "patch">)
  | ({ type: "OBJECT_DELETE"; objectId: string } & Pick<ObjectDeleteRequest, "baseObjectVersion">)
  | ({ type: "OBJECT_RESTORE"; objectId: string } & Pick<ObjectRestoreRequest, "baseObjectVersion">);
```

### Rule

Undo is not local-only. Undo must become a new accepted operation and be broadcast to other clients.
The wrapper `clientOpId` and `roomId` identify the accepted undo/redo operation; nested operation bodies do not carry their own `clientOpId` or `roomId`.

---

## 13.2 `redo:request`

### Direction

```txt
Client -> Server
```

### Payload

```ts
type RedoRequest = {
  clientOpId: string;
  roomId: string;
  redoOperation: UndoRedoOperation;
};
```

---

# 14. Generic Error Event

## 14.1 `error`

### Direction

```txt
Server -> Client
```

### Payload

```ts
type SocketErrorEvent = {
  code: string;
  message: string;
  details?: unknown;
};
```

Use this for non-operation errors, such as invalid room join or authentication failure.

---

# 15. Permission Matrix for WebSocket Events

| Event | Owner | Editor | Viewer | Guest public join |
|---|---:|---:|---:|---:|
| room:join | Yes | Yes | Yes | Yes if public |
| room:leave | Yes | Yes | Yes | Yes |
| cursor:update | Yes | Yes | Yes | Yes |
| selection:update | Yes | Yes | Yes | Yes |
| object:create | Yes | Yes | No | Depends on assigned role |
| object:update | Yes | Yes | No | Depends on assigned role |
| object:delete | Yes | Yes | No | Depends on assigned role |
| sync:request | Yes | Yes | Yes | Yes if room access valid |
| editing:start | Yes | Yes | No | Depends on assigned role |
| editing:end | Yes | Yes | No | Depends on assigned role |
| object:transform-preview | Yes | Yes | No | Depends on assigned role |
| undo:request | Yes | Yes | No | Depends on assigned role |
| redo:request | Yes | Yes | No | Depends on assigned role |

---

# 16. Validation Rules

## 16.1 Common validation

```txt
- roomId must be UUID.
- clientOpId must be present for persistent operations.
- objectId must be UUID for update/delete/restore.
- baseObjectVersion must be a positive integer for update/delete/restore.
- object update patches must only contain mutable canvas fields.
- Coordinates must be finite numbers.
- Width/height must be positive when provided.
- Text length must be limited.
- Style values must match allowed schema.
```

---

## 16.2 Object-specific validation

### RECTANGLE

```txt
Required: x, y, width, height
Optional: rotation, style, zIndex
```

### CIRCLE

```txt
Required: x, y, width, height
Behavior: width == height means circle, otherwise ellipse
```

### LINE

```txt
Required: points = [x1, y1, x2, y2]
Optional: style.arrowStart, style.arrowEnd
```

### TEXT

```txt
Required: x, y, text
Optional: width, height, fontSize, color, rotation
```

---

# 17. Broadcast Rules

```txt
1. Persistent operations are broadcast to all clients in the room, including sender.
2. Cursor events are broadcast to other clients in the room, excluding sender.
3. Presence updates are broadcast to all clients in the room.
4. Operation rejection is sent only to the sender.
5. Sync response is sent only to the requesting client.
6. No event should be broadcast globally.
```

---

# 18. Client Implementation Rules

```txt
1. Do not directly trust local mutation as final state.
2. Apply shared persistent changes from operation:applied.
3. Store lastSeenRevision after each accepted operation.
4. On operation rejection, rollback or replace local state using latestObject.
5. Throttle cursor:update.
6. Emit selection:update when local object selection changes.
7. Do not send edit operations if current role is VIEWER, but backend must still enforce this.
8. Ignore events from unknown rooms.
```

---

# 19. MVP vs Should-Have Events

## MVP events

```txt
room:join
room:leave
room:state
presence:update
selection:update
cursor:update
cursor:updated
object:create
object:update
object:delete
operation:applied
operation:rejected
sync:request
sync:response
error
```

## Should-have events

```txt
editing:start
editing:end
object:editing
object:transform-preview
object:transform-previewed
undo:request
redo:request
```

---

# 20. Final WebSocket Contract Decision

The WebSocket contract uses:

```txt
Socket.IO room-based events.
Persistent object operations with clientOpId.
Server-approved operation:applied as the only final shared-state update.
operation:rejected for conflict and permission feedback.
sync:request/sync:response for reconnect recovery.
Transient cursor/presence/editing events without persistence.
```

This contract is intentionally explicit so that frontend, backend, and coding agents can implement the realtime behavior consistently.
