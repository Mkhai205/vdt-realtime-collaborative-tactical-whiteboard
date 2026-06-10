# 05. Realtime Synchronization Design

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 — Software Engineer Track  
**Document version:** v0.1  
**Status:** Draft  

---

## 1. Purpose

This document defines the realtime synchronization model for the **Realtime Collaborative Tactical Whiteboard**.

The system must allow multiple users to join the same room and see canvas changes, cursor positions, online users, and recovery state in realtime.

This document covers:

- Synchronization principles
- Persistent operations
- Transient events
- Room revision
- Object version
- Conflict handling
- Reconnect synchronization
- Undo/redo synchronization
- Presence and cursor synchronization

---

## 2. Synchronization Goals

| Goal | Description |
|---|---|
| Realtime object sync | Object creation, update, and deletion must be visible to other users in the same room. |
| Server-authoritative consistency | The server decides which operations are accepted and in what order. |
| Persistence | Accepted operations must be persisted to database. |
| Recovery | A reconnecting client must recover missed changes. |
| Conflict detection | Stale object updates must be detected by object version. |
| Efficient transient updates | Cursor/presence updates must not be persisted or increase room revision. |
| Permission enforcement | Viewers must not be able to mutate room state. |

---

## 3. Core Synchronization Model

The system uses the following model:

```txt
Server-authoritative operation-based synchronization
```

The client does not directly modify shared persistent state. Instead:

```txt
1. Client creates an operation request.
2. Client sends the request to the server through WebSocket.
3. Server validates identity, permission, payload, and object version.
4. Server applies the operation inside a database transaction.
5. Server increments object version and room revision.
6. Server stores an operation log record.
7. Server broadcasts the accepted operation to all clients in the room.
8. Clients apply the accepted operation to local state.
```

---

## 4. Key Concepts

## 4.1 Room revision

Each room has a monotonically increasing `currentRevision`.

The database stores revisions as `BigInt`. REST and WebSocket contracts expose revision values as `number` for the MVP, and the backend must convert Prisma `BigInt` values before returning JSON. The MVP assumes room revisions stay within JavaScript's safe integer range.

A room revision is incremented only when a persistent operation is accepted:

```txt
OBJECT_CREATE
OBJECT_UPDATE
OBJECT_DELETE
OBJECT_RESTORE
```

Transient events do not increment revision:

```txt
cursor:update
presence:update
selection:update
editing:start
editing:end
```

### Purpose

`currentRevision` is used for:

- Operation ordering.
- Reconnect synchronization.
- Operation history.
- Debugging and demo explanation.

---

## 4.2 Object version

Each whiteboard object has a monotonically increasing `version`.

Object version is incremented when the object is updated or logically deleted.

### Purpose

`version` is used for:

- Detecting stale updates.
- Preventing accidental overwrite.
- Supporting conflict feedback.
- Enabling safe undo/redo validation.

---

## 4.3 Client operation ID

Each client-generated operation contains a `clientOpId`.

```ts
type ClientOperationBase = {
  clientOpId: string;
  roomId: string;
  baseRoomRevision?: number;
};
```

### Purpose

`clientOpId` is used for:

- Idempotency.
- Avoiding duplicate operation processing after retry/reconnect.
- Matching `operation:applied` or `operation:rejected` to local pending operations.

Recommended format:

```txt
crypto.randomUUID()
```

---

## 5. Operation Categories

## 5.1 Persistent operations

Persistent operations are stored in database and increase room revision.

| Operation | Description |
|---|---|
| OBJECT_CREATE | Create a new rectangle, circle/ellipse, line/arrow, or text object. |
| OBJECT_UPDATE | Update object position, size, rotation, style, text, zIndex. |
| OBJECT_DELETE | Soft delete an object. |
| OBJECT_RESTORE | Restore an object through undo. Should-have. |

---

## 5.2 Transient collaboration events

Transient events are realtime-only and not stored in database.

| Event | Description |
|---|---|
| cursor:update | Broadcast user's cursor position. |
| selection:update | Update selected object in transient presence state. |
| editing:start | User starts editing/dragging/selecting an object. |
| editing:end | User stops editing/dragging/selecting an object. |
| presence:update | User online/offline/current state. |
| object:transform-preview | Client sends transient drag/resize preview. |
| object:transform-previewed | Server broadcasts transient drag/resize preview. |

---

## 6. Persistent Operation Format

## 6.1 Base operation

```ts
type OperationBase = {
  clientOpId: string;
  roomId: string;
  baseRoomRevision?: number;
};
```

---

## 6.2 Create object operation

```ts
type ObjectCreateRequest = OperationBase & {
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

Server behavior:

```txt
1. Validate user is owner/editor.
2. Validate object payload.
3. Create object with version = 1.
4. Increment room revision.
5. Store operation log.
6. Broadcast operation:applied.
```

---

## 6.3 Update object operation

```ts
type ObjectUpdateRequest = OperationBase & {
  objectId: string;
  baseObjectVersion: number;
  patch: Partial<{
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
};
```

Server behavior:

```txt
1. Validate user is owner/editor.
2. Load object.
3. Reject if object does not exist or was deleted.
4. Compare baseObjectVersion with current object version.
5. If baseObjectVersion does not match current object.version, reject and return latest object.
6. Apply patch.
7. Increment object version.
8. Increment room revision.
9. Store operation log.
10. Broadcast operation:applied.
```

---

## 6.4 Delete object operation

```ts
type ObjectDeleteRequest = OperationBase & {
  objectId: string;
  baseObjectVersion: number;
};
```

Server behavior:

```txt
1. Validate user is owner/editor.
2. Load object.
3. Reject if object does not exist or was already deleted.
4. Check baseObjectVersion.
5. Set deletedAt.
6. Increment object version.
7. Increment room revision.
8. Store operation log with previous object data for undo/history.
9. Broadcast operation:applied.
```

---

## 7. Accepted Operation Payload

Server broadcasts accepted operations using a normalized format.

```ts
type OperationAppliedEvent = {
  operationId: string;
  clientOpId: string;
  roomId: string;
  revision: number;
  type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE" | "OBJECT_RESTORE";
  objectId?: string;
  actor: {
    id: string;
    name: string;
    avatarColor?: string;
    avatarUrl?: string;
  };
  payload: unknown;
  resultingObject?: WhiteboardObject | null;
  createdAt: string;
};
```

Revision fields in this event are serialized as `number` even though the database stores them as `BigInt`.

### Client rule

Clients must apply only `operation:applied` events from the server for shared persistent state.

Local previews are allowed but must be reconciled with server-accepted state.

---

## 8. Room Join Synchronization

When a user joins a room, the server returns the current state.

```ts
type RoomStateEvent = {
  room: {
    id: string;
    name: string;
    description?: string;
    currentRevision: number;
    isPublic: boolean;
    defaultJoinRole: "EDITOR" | "VIEWER";
  };
  currentUser: {
    id: string;
    name: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
    avatarColor?: string;
    avatarUrl?: string;
  };
  objects: WhiteboardObject[];
  onlineUsers: OnlineUser[];
};
```

Join flow:

```txt
1. Client connects socket.
2. Client emits room:join.
3. Server validates access.
4. Server joins socket to room channel.
5. Server sends room:state to joining client.
6. Server broadcasts presence:update to other clients.
```

---

## 9. Cursor Synchronization

Cursor position is transient and not persisted.

```ts
type CursorUpdateRequest = {
  roomId: string;
  x: number;
  y: number;
  selectedObjectId?: string | null;
  currentTool?: Tool;
};
```

Client behavior:

```txt
- Send cursor:update when mouse moves over canvas.
- Throttle to 30-50ms.
- Do not send if cursor position does not change significantly.
```

Server behavior:

```txt
- Validate user is in room.
- Broadcast to other users in the same room.
- Do not persist.
- Do not increment room revision.
```

Broadcast payload:

```ts
type CursorUpdatedEvent = {
  roomId: string;
  user: {
    id: string;
    name: string;
    avatarColor?: string;
    avatarUrl?: string;
  };
  x: number;
  y: number;
  selectedObjectId?: string | null;
  currentTool?: Tool;
  timestamp: string;
};
```

---

## 10. Presence Synchronization

Presence is maintained in memory on the backend.

### Presence state

```ts
type OnlineUser = {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  avatarColor?: string;
  avatarUrl?: string;
  status: "ONLINE";
  selectedObjectId?: string | null;
  connectedAt: string;
};
```

### Offline rule

MVP rule:

```txt
Socket disconnect means offline immediately.
```

Future enhancement:

```txt
Use a grace period of 5-30 seconds before marking user offline.
```

---

## 10.1 Selection Presence

Selected object presence is maintained in memory on the backend and is not persisted.

```ts
type SelectionUpdateRequest = {
  roomId: string;
  selectedObjectId: string | null;
};
```

Server behavior:

```txt
- Validate user is in room.
- Store selectedObjectId on the socket presence session.
- Broadcast presence:update to the room.
- Do not increment room revision.
```

UI behavior:

```txt
If another user has selected an object, show a colored non-blocking indicator on that object.
Selection presence does not prevent other users from editing.
```

---

## 11. Editing Indicator / Soft Lock

Soft lock is a should-have feature.

It does not block editing by default. It warns other users that an object is being edited.

```ts
type EditingStartRequest = {
  roomId: string;
  objectId: string;
};

type EditingEndRequest = {
  roomId: string;
  objectId: string;
};
```

Broadcast:

```ts
type ObjectEditingEvent = {
  roomId: string;
  objectId: string;
  user: {
    id: string;
    name: string;
    avatarColor?: string;
  };
  status: "STARTED" | "ENDED";
  timestamp: string;
};
```

UI behavior:

```txt
If another user is editing an object, show a colored border or label:
"<userName> is editing".
```

---

## 12. Transform Synchronization

## 12.1 MVP behavior

For MVP, object transformations are persisted when the interaction ends:

```txt
Drag -> persist on dragend
Resize -> persist on transformend
Rotate -> persist on transformend
```

---

## 12.2 Should-have preview behavior

Realtime preview during transform is a should-have feature.

Preview event:

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

Rules:

```txt
- Preview events are throttled.
- Preview events are not persisted.
- Preview events do not increment object version.
- Preview events do not increment room revision.
- Final object:update is still required on dragend/transformend.
```

---

## 13. Conflict Handling

## 13.1 Conflict policy

The system uses:

```txt
Object-level version checking + server-side operation ordering
```

Official policy:

```txt
- Server detects stale updates using baseObjectVersion.
- If baseObjectVersion does not match current object.version, reject with OBJECT_VERSION_CONFLICT.
- Updates to deleted objects are rejected.
- Field-level merge is not implemented in the MVP.
- Accepted operations are ordered by room revision.
- Last-write-wins only applies among operations accepted by the server in transaction order.
```

---

## 13.2 Conflict cases

| Case | Policy |
|---|---|
| Two users update different objects | Accept both. |
| Two users update same object from the same base version | Accept the first committed operation; reject the second with latest object. |
| User sends stale update to same object | Reject with `OBJECT_VERSION_CONFLICT`. Return latest object. |
| User updates deleted object | Reject. |
| Viewer sends edit operation | Reject due to permission. |
| Duplicate clientOpId | Return previous result or reject as duplicate. |

---

## 13.3 Conflict rejected payload

```ts
type OperationRejectedEvent = {
  clientOpId: string;
  roomId: string;
  reason:
    | "PERMISSION_DENIED"
    | "OBJECT_NOT_FOUND"
    | "OBJECT_ALREADY_DELETED"
    | "OBJECT_VERSION_CONFLICT"
    | "INVALID_OPERATION_PAYLOAD"
    | "DUPLICATE_OPERATION";
  message: string;
  latestObject?: WhiteboardObject | null;
  currentRoomRevision?: number;
};
```

Client behavior:

```txt
- Show toast message.
- If latestObject exists, update local object state.
- Clear pending operation.
```

---

## 14. Reconnect Synchronization

## 14.1 Client state

Client stores:

```txt
roomId
lastSeenRevision
```

`lastSeenRevision` is updated whenever the client applies `operation:applied`.

---

## 14.2 Sync request

```ts
type SyncRequest = {
  roomId: string;
  lastSeenRevision: number;
};
```

---

## 14.3 Sync response

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

---

## 14.4 Server sync algorithm

```txt
1. Validate user access to room.
2. Load room.currentRevision.
3. If lastSeenRevision >= currentRevision:
   - return empty OPERATIONS response.
4. Try to load operations where revision > lastSeenRevision.
5. If operations are available and not too many:
   - return OPERATIONS.
6. Otherwise:
   - return FULL_STATE with current objects and revision.
```

---

## 15. Undo/Redo Synchronization

Undo/redo is a should-have feature.

### Scope

```txt
- Undo/redo is per-user.
- Undo/redo stack is stored in client memory.
- Undo/redo stack is not persisted after browser reload.
- Undo/redo creates new operations and is broadcast to other clients.
```

### Example

If user creates an object:

```txt
Original operation: OBJECT_CREATE
Undo operation: OBJECT_DELETE
Redo operation: OBJECT_RESTORE or OBJECT_CREATE depending on implementation
```

If user updates an object:

```txt
Original operation: OBJECT_UPDATE { x: 100, y: 200 }
Undo operation: OBJECT_UPDATE { x: previousX, y: previousY }
```

### Server rule

Undo operations must still pass permission and object version validation.

If an object was deleted by another user before undo:

```txt
Reject undo operation and show toast.
```

---

## 16. Operation Processing Transaction

Persistent operations should be processed inside a database transaction.

Example for `object:update`:

```txt
1. Start transaction.
2. Validate room membership and role.
3. Load target object.
4. Validate object is not deleted.
5. Check object version.
6. Apply patch to object.
7. Increment object version.
8. Increment room currentRevision.
9. Insert operation log.
10. Commit transaction.
11. Broadcast accepted operation after commit.
```

Important rule:

```txt
Never broadcast before transaction commit.
```

---

## 17. Client Application Rules

Clients must follow these rules:

```txt
1. Shared persistent state is updated from server-approved operations.
2. Local previews are temporary and may be overwritten by server state.
3. Client must ignore operations from other rooms.
4. Client must update lastSeenRevision after applying accepted operations.
5. Client must handle operation rejection gracefully.
6. Client must not assume viewer restrictions are enough; server decides.
```

---

## 18. Performance Rules

| Area | Rule |
|---|---|
| Cursor | Throttle to 30-50ms. |
| Object drag | Persist on dragend; preview only if implemented. |
| Resize/rotate | Persist on transformend. |
| Operation log | Paginate history; load latest 50 for UI. |
| Sync | Replay missing operations; fallback full state if needed. |
| Broadcast | Emit only to `room:{roomId}`. |

---

## 19. Non-Goals

The realtime synchronization design does not include:

```txt
- CRDT/Yjs full implementation
- Peer-to-peer synchronization
- Global room broadcast
- True infinite canvas synchronization
- Multiplayer cursor replay history
- Persisted zoom/pan synchronization
- Operational transform algorithm
```

---

## 20. Final Realtime Design Decision

The MVP realtime design is:

```txt
Server-authoritative WebSocket synchronization using Socket.IO.
Persistent object operations are validated and committed on the server.
Each accepted operation receives a room revision.
Each object has an object version for conflict detection.
Realtime cursor/presence events are transient and not persisted.
Reconnect uses lastSeenRevision to replay missing operations or fallback to full state.
Undo/redo is implemented as new operations in the should-have scope.
```
