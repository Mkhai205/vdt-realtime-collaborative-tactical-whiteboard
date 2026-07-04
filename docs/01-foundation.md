# 📐 Plan 01 — Foundation: API Client, Socket, Zustand Stores

> **Ưu tiên**: 🔴 Critical — Tất cả features khác phụ thuộc vào module này  
> **Ước tính**: 0.5 ngày  
> **Phụ thuộc**: Không có

---

## 🎯 Mục tiêu

Thiết lập "xương sống" của frontend:
1. **Axios instance** với JWT auth header, tự động refresh token khi 401
2. **Socket.IO client** singleton kết nối namespace `/boards`
3. **Zustand stores** cho auth, board state, và UI state
4. **React hooks** để subscribe socket events

---

## 📁 Các file cần tạo/chỉnh sửa

### `lib/api/axios.ts`
```typescript
// Axios instance với baseURL = NEXT_PUBLIC_API_URL
// Default headers: Content-Type: application/json
// withCredentials: true (để gửi cookie refresh token)
// Request interceptor: gắn Authorization: Bearer {accessToken} từ auth store
// Response interceptor: nếu 401 → gọi refresh → retry request gốc
// Nếu refresh fail → logout + redirect /login
```

**Key details**:
- `baseURL`: `process.env.NEXT_PUBLIC_API_URL` (ví dụ: `http://localhost:3001/api/v1`)
- `withCredentials: true` bắt buộc để HttpOnly refresh token cookie hoạt động
- Dùng queue để tránh nhiều request 401 gọi refresh đồng thời (refresh lock pattern)

### `lib/api/query-client.ts`
```typescript
// QueryClient singleton với config:
// staleTime: 30s (board data không thay đổi thường)
// retry: 1
// onError: toast notification
```

### `lib/socket/socket.ts`
```typescript
// Socket.IO client cho namespace /boards
// URL: process.env.NEXT_PUBLIC_WS_URL
// auth: { token: accessToken } — JWT được gửi khi connect
// autoConnect: false (kết nối thủ công khi vào board)
// reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000
// Transport: ['websocket', 'polling']
```

**Quan trọng**: Socket phải reconnect với token mới khi access token được refresh.

### `lib/socket/useSocket.ts`
```typescript
// Hook: useSocketEvent(event, handler) — subscribe & auto-unsubscribe
// Hook: useSocketEmit() — return typed emit function
```

### `stores/auth.store.ts`
```typescript
interface AuthState {
  user: UserSummary | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: UserSummary, accessToken: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}
// persist middleware → localStorage key: 'rctw-auth'
// Chỉ persist: user, accessToken (không persist loading state)
```

### `stores/board.store.ts`
```typescript
interface BoardStore {
  // Canvas data
  boardId: string | null;
  objects: Map<string, BoardObjectDto>;
  revision: number;

  // Collaboration state
  onlineUsers: OnlineUser[];
  editingStates: Map<string, EditingStateEntry>; // objectId → editor

  // Optimistic operations
  pendingOps: Map<string, OptimisticOp>; // clientOpId → original state

  // Actions
  initBoard: (state: BoardStateEvent) => void;
  upsertObject: (obj: BoardObjectDto) => void;
  removeObject: (objectId: string) => void;
  applyUndoRedo: (event: UndoRedoEvent) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  updatePresence: (event: PresenceUpdateEvent) => void;
  setEditingState: (objectId: string, entry: EditingStateEntry | null) => void;
  setRevision: (revision: number) => void;

  // Optimistic
  addPendingOp: (clientOpId: string, originalState: BoardObjectDto | null) => void;
  commitPendingOp: (clientOpId: string) => void;
  rollbackPendingOp: (clientOpId: string) => void;
}
```

### `stores/ui.store.ts`
```typescript
interface UIStore {
  // Tool selection (từ shared-contracts Tool enum)
  activeTool: Tool; // SELECT | HAND | RECTANGLE | CIRCLE | LINE | TEXT | PATH | ICON
  
  // Selection state
  selectedIds: Set<string>;
  
  // Clipboard
  clipboard: BoardObjectDto[];
  
  // Viewport (camera position trong canvas coordinates)
  viewport: {
    x: number;      // pan offset
    y: number;
    scale: number;  // zoom level (0.1 – 4.0)
  };

  // Drawing state
  isDrawing: boolean;
  drawingStartPoint: { x: number; y: number } | null;

  // Actions
  setActiveTool: (tool: Tool) => void;
  setSelectedIds: (ids: Set<string>) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  setViewport: (viewport: UIStore['viewport']) => void;
  setIsDrawing: (drawing: boolean) => void;
}
```

---

## 🔧 Env Variables cần thêm

File `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## 🔄 Token Refresh Flow

```
Request → 401 response
    ↓
Check: is already refreshing? 
    → YES: queue request, wait
    → NO: set refreshing = true
        ↓
    POST /auth/refresh (cookie)
        → SUCCESS: update accessToken in store, retry all queued requests
        → FAIL: clearAuth(), redirect to /login
```

---

## ✅ Acceptance Criteria

- [ ] `apiClient.get('/users/me')` tự động gắn Authorization header
- [ ] Khi accessToken hết hạn, request tự động refresh và retry
- [ ] `socket` singleton kết nối `/boards` namespace với JWT auth
- [ ] `useSocketEvent('board:state', handler)` subscribe và cleanup đúng
- [ ] `useAuthStore()` persist user qua page refresh
- [ ] `useBoardStore()` có thể upsert/remove objects
- [ ] `useUIStore()` quản lý activeTool và selectedIds
