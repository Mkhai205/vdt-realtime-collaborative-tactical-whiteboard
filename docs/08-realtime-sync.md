# ⚡ Plan 08 — Realtime Sync: Socket.IO Integration

> **Ưu tiên**: 🔴 Critical  
> **Ước tính**: 1.5 ngày  
> **Phụ thuộc**: Plan 01 (Foundation), Plan 04, Plan 05

---

## 🎯 Mục tiêu

Implement toàn bộ Socket.IO integration:
1. **Connect** khi vào board page, **disconnect** khi rời
2. **Emit** tất cả client events (create, update, delete, undo, redo)
3. **Receive** tất cả server events và cập nhật UI
4. **Optimistic updates** với rollback khi conflict
5. **Reconnect sync** khi mất kết nối rồi kết nối lại

---

## 📡 Event Reference (từ shared-contracts)

### Client → Server
```typescript
ClientEvents = {
  BOARD_JOIN: 'board:join',
  BOARD_LEAVE: 'board:leave',
  BOARD_SYNC: 'board:sync',
  OBJECT_CREATE: 'object:create',
  OBJECT_UPDATE: 'object:update',
  OBJECT_DELETE: 'object:delete',
  OPERATION_UNDO: 'operation:undo',
  OPERATION_REDO: 'operation:redo',
  CURSOR_MOVE: 'cursor:move',
  OBJECT_EDITING: 'object:editing',
}
```

### Server → Client
```typescript
ServerEvents = {
  BOARD_STATE: 'board:state',         // Initial state on join
  SYNC_RESPONSE: 'sync:response',     // Delta after reconnect
  OBJECT_CREATED_ACK: 'object:created:ack',     // To sender only
  OBJECT_UPDATED_ACK: 'object:updated:ack',
  OBJECT_DELETED_ACK: 'object:deleted:ack',
  OBJECT_CREATED: 'object:created',   // Broadcast to room
  OBJECT_UPDATED: 'object:updated',
  OBJECT_DELETED: 'object:deleted',
  OPERATION_UNDOREDO: 'operation:undoredo',
  PRESENCE_UPDATE: 'presence:update',
  CURSOR_MOVED: 'cursor:moved',
  OBJECT_EDITING: 'object:editing',
  JOIN_REQUEST_CREATED: 'join-request:created',
  ERROR: 'error',
}
```

---

## 📁 Files cần tạo

### `lib/socket/socket.ts`
```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      namespace: '/boards',
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(accessToken: string): void {
  const sock = getSocket();
  sock.auth = { token: accessToken };
  sock.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
```

### `lib/socket/useSocketEvent.ts`
```typescript
// Hook tự động subscribe và unsubscribe socket events
export function useSocketEvent<T>(
  event: string,
  handler: (data: T) => void,
  deps: DependencyList = []
): void {
  useEffect(() => {
    const sock = getSocket();
    sock.on(event, handler);
    return () => { sock.off(event, handler); };
  }, [event, ...deps]);
}
```

### `features/board/hooks/useBoardSocket.ts`
```typescript
// Hook chính quản lý toàn bộ socket lifecycle cho board page
//
// 1. onMount: connectSocket(accessToken), emit board:join
// 2. onUnmount: emit board:leave, disconnectSocket
// 3. Subscribe tất cả server events
//
// Returns: { isConnected, connectionStatus }
```

### `features/board/hooks/useBoardEvents.ts`
```typescript
// Subscribe và handle tất cả server events:

// board:state → initBoard(event)
//   - Khởi tạo objects, revision, onlineUsers, editingStates

// object:created:ack (to me) → commitPendingOp(clientOpId)
//   - Xác nhận optimistic op thành công

// object:updated:ack → commitPendingOp(clientOpId)
// object:deleted:ack → commitPendingOp(clientOpId)

// object:created (from others) → upsertObject(event.object)
// object:updated (from others) → upsertObject(event.object)
// object:deleted (from others) → removeObject(event.objectId)

// operation:undoredo → applyUndoRedo(event)
//   - Có thể là undo/redo của mình hoặc của người khác

// presence:update → updatePresence(event)
// cursor:moved → updateCursor(event)
// object:editing → setEditingState(event)

// sync:response → applySyncDelta(event.operations)
//   - Apply từng operation theo thứ tự revision

// error → handleWsError(event)
//   - Nếu OBJECT_VERSION_CONFLICT → rollbackPendingOp
//   - Khác → toast.error
```

### `features/board/hooks/useObjectMutations.ts`
```typescript
// Hook cung cấp typed emit functions cho các mutations:

function useObjectMutations() {
  const socket = getSocket();
  const { boardId } = useBoardStore();
  const { addPendingOp, rollbackPendingOp, objects } = useBoardStore();

  const createObject = (payload: ObjectCreatePayload) => {
    const clientOpId = nanoid();
    // Optimistic: tạo temp object với temp ID
    const tempObj = { ...payload, id: `temp-${clientOpId}`, version: 0 };
    upsertObject(tempObj);
    addPendingOp(clientOpId, null); // null = new object (no previous state)
    
    socket.emit(ClientEvents.OBJECT_CREATE, {
      clientOpId,
      boardId,
      object: payload,
    });
  };

  const updateObject = (objectId: string, patch: ObjectUpdatePatch) => {
    const clientOpId = nanoid();
    const current = objects.get(objectId)!;
    
    // Optimistic: apply patch immediately
    upsertObject({ ...current, ...patch });
    addPendingOp(clientOpId, current); // save original for rollback
    
    socket.emit(ClientEvents.OBJECT_UPDATE, {
      clientOpId,
      boardId,
      objectId,
      baseVersion: current.version,
      patch,
    });
  };

  const deleteObject = (objectId: string) => {
    const clientOpId = nanoid();
    const current = objects.get(objectId)!;
    
    // Optimistic: remove from store
    removeObject(objectId);
    addPendingOp(clientOpId, current);
    
    socket.emit(ClientEvents.OBJECT_DELETE, {
      clientOpId,
      boardId,
      objectId,
      baseVersion: current.version,
    });
  };

  const undo = () => socket.emit(ClientEvents.OPERATION_UNDO, { boardId });
  const redo = () => socket.emit(ClientEvents.OPERATION_REDO, { boardId });

  return { createObject, updateObject, deleteObject, undo, redo };
}
```

### `features/board/hooks/useReconnectSync.ts`
```typescript
// Handle reconnection sync:
//
// socket.on('connect') sau initial connect → đã có board:state
// socket.on('reconnect') → emit board:sync { boardId, lastSeenRevision }
//
// Nhận sync:response:
//   applySyncDelta(operations: BoardOperationDto[]) {
//     Sort operations by revision
//     For each op:
//       OBJECT_CREATE/RESTORE → upsertObject(op.payload)
//       OBJECT_UPDATE → upsertObject(merge current + op.payload)
//       OBJECT_DELETE → removeObject(op.objectId)
//     setRevision(latestRevision)
//   }
```

---

## 🔄 Optimistic Update Flow

```
User action (e.g., drag to new position)
    ↓
1. Save current state → pendingOps Map
2. Apply new state to store immediately (optimistic)
3. Emit socket event với baseVersion
    ↓
Server validates:
    ✅ Success → emit ACK
    4a. commitPendingOp(clientOpId) — xóa khỏi pending

    ❌ Version conflict → emit error
    4b. rollbackPendingOp(clientOpId) — restore saved state
    4c. toast.error("Update conflict, refreshing state")
    4d. Emit board:sync để lấy state mới nhất
```

---

## 🔗 Connection Status UI

```typescript
// Hiển thị connection status:
// ● Connected (green)
// ● Reconnecting... (yellow, spinner)  
// ● Disconnected (red)

// Component: ConnectionStatus.tsx
// Vị trí: bottom-left của canvas
// Auto-hide sau 3 giây khi Connected
```

---

## ⏱️ Cursor Throttle

```typescript
// cursor:move event throttle (không gửi mỗi mouse move)
// Throttle 50ms (20 events/giây)

const throttledEmitCursor = useMemo(
  () => throttle((x: number, y: number) => {
    socket.emit(ClientEvents.CURSOR_MOVE, { boardId, x, y });
  }, 50),
  [boardId]
);

// Stage.onMouseMove → worldPos → throttledEmitCursor(worldX, worldY)
```

---

## 🧩 UndoRedo Event Handler

```typescript
// operation:undoredo event từ server:
// Broadcast tới cả room (kể cả initiator)
//
// payload: UndoRedoEvent {
//   boardId, actorId,
//   appliedOperations: BoardOperationDto[]
// }
//
// applyUndoRedo(event):
//   for op of event.appliedOperations:
//     switch op.type:
//       OBJECT_CREATE/RESTORE → upsertObject(deserialize op.payload)
//       OBJECT_UPDATE → upsertObject(merge current + op.payload)
//       OBJECT_DELETE → removeObject(op.objectId)
//   setRevision(max revision in operations)
```

---

## ✅ Acceptance Criteria

- [ ] Vào board page → socket connect, board:join emit, nhận board:state
- [ ] Rời board page → board:leave emit, socket disconnect  
- [ ] Tạo shape → xuất hiện ngay (optimistic), sau đó sync server
- [ ] Xóa shape → biến mất ngay (optimistic)
- [ ] User B thay đổi shape → User A thấy ngay (< 200ms)
- [ ] Version conflict → rollback + toast notification
- [ ] Disconnect và reconnect → board:sync → delta applied đúng
- [ ] Undo/Redo của bất kỳ user nào → tất cả users thấy
- [ ] Cursor move throttled 50ms, không gây lag
- [ ] Connection status indicator hiển thị đúng trạng thái
