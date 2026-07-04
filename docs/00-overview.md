# 🗂️ Master Plan — Realtime Collaborative Whiteboard (Frontend)

> **Trạng thái**: Backend hoàn chỉnh ✅ — Frontend cần build toàn bộ 🚧\
> \***\*Timeline mục tiêu**: 1–2 tuần (MVP)\
> \***\*Stack**: Next.js 16 (App Router) + React-Konva + Zustand + Socket.IO + TanStack Query

---

## 📋 Tổng quan

Dự án là một **Realtime Collaborative Whiteboard** đa năng (tham khảo Excalidraw), cho phép nhiều người dùng cùng vẽ và chỉnh sửa trên một canvas vô hạn theo thời gian thực.

Backend (NestJS) đã **hoàn toàn sẵn sàng** với:

- REST API đầy đủ (Auth, User, Board, Member, Share Link, Invitation)
- WebSocket gateway (Socket.IO `/boards` namespace) với tất cả event handlers
- PostgreSQL + Prisma schema + Redis presence
- Optimistic concurrency, per-user undo/redo, snapshot system

**Frontend** hiện tại chỉ là skeleton — mọi page/feature đều rỗng và cần implement từ đầu.

---

## 🗺️ Danh sách Plans

| \#  | File                                               | Mô tả                                                               | Ưu tiên     |
| --- | -------------------------------------------------- | ------------------------------------------------------------------- | ----------- |
| 01  | [01-foundation.md](./01-foundation.md)             | Foundation: Axios client, Socket.IO client, Zustand stores          | 🔴 Critical |
| 02  | [02-auth.md](./02-auth.md)                         | Authentication: Google OAuth login page, auth state, token refresh  | 🔴 Critical |
| 03  | [03-dashboard.md](./03-dashboard.md)               | Dashboard: Board listing, create board, board cards, search         | 🔴 Critical |
| 04  | [04-canvas-core.md](./04-canvas-core.md)           | Canvas Core: Konva stage, pan/zoom, infinite canvas, viewport       | 🔴 Critical |
| 05  | [05-canvas-shapes.md](./05-canvas-shapes.md)       | Canvas Shapes: 6 renderers (Rect, Circle, Line, Text, Path, Icon)   | 🔴 Critical |
| 06  | [06-canvas-tools.md](./06-canvas-tools.md)         | Canvas Tools: Toolbar, tool selection, draw mode, shape creation    | 🔴 Critical |
| 07  | [07-canvas-selection.md](./07-canvas-selection.md) | Selection & Transform: Lasso, multi-select, resize, rotate, move    | 🔴 Critical |
| 08  | [08-realtime-sync.md](./08-realtime-sync.md)       | Realtime Sync: Socket.IO events, optimistic updates, rollback       | 🔴 Critical |
| 09  | [09-presence.md](./09-presence.md)                 | Presence & Cursors: Live cursors, online user list, editing locks   | 🟡 High     |
| 10  | [10-board-settings.md](./10-board-settings.md)     | Board Settings: Members, share links, invitations, permissions UI   | 🟡 High     |
| 11  | [11-ux-polish.md](./11-ux-polish.md)               | UX Polish: Keyboard shortcuts, undo/redo UI, error handling, themes | 🟢 Medium   |

---

## 🏗️ Kiến trúc Frontend

```
apps/web/src/
├── app/                            # Next.js App Router pages
│   ├── (auth)/login/page.tsx       # Google OAuth login
│   ├── dashboard/page.tsx          # Board dashboard
│   └── board/[boardId]/page.tsx    # Canvas editor
│
├── features/                       # Feature-sliced modules
│   ├── auth/
│   │   ├── api/auth.api.ts         # loginGoogle(), refreshToken(), logout()
│   │   ├── components/LoginButton  # Google OAuth button
│   │   ├── hooks/useAuth.ts        # Auth state hook
│   │   └── store/auth.store.ts     # Zustand: user, accessToken
│   ├── board/
│   │   ├── api/board.api.ts        # CRUD boards, members, share links
│   │   ├── components/             # BoardCard, CreateBoardDialog, etc.
│   │   ├── hooks/                  # useBoard, useBoardMembers, etc.
│   │   └── store/board.store.ts    # Zustand: objects, revision, onlineUsers
│   ├── dashboard/
│   │   ├── components/             # BoardGrid, BoardSearch, EmptyState
│   │   └── hooks/useBoards.ts      # Board list with React Query
│   ├── cursor/
│   │   ├── components/CursorOverlay.tsx  # Remote cursor HTML overlay
│   │   └── hooks/useCursorSync.ts        # Emit cursor:move, receive cursor:moved
│   └── presence/
│       ├── components/PresenceBar.tsx    # Online users avatars
│       └── hooks/usePresence.ts          # Sync presence state
│
├── lib/
│   ├── api/
│   │   ├── axios.ts                # Axios instance, base URL, interceptors
│   │   └── refresh.ts              # Token refresh + 401 retry logic
│   └── socket/
│       ├── socket.ts               # Socket.IO client singleton (namespace /boards)
│       └── useSocket.ts            # React hook for socket events
│
└── stores/
    ├── auth.store.ts               # User session (persist localStorage)
    ├── board.store.ts              # Objects map, revision, editingStates
    └── ui.store.ts                 # activeTool, selectedIds, viewport
```

---

## 🎨 Design System

### Theme

- **Light mode mặc định** + Dark mode toggle (next-themes)
- Color palette: neutral grays + accent violet/indigo
- Font: Inter (Google Fonts)

### Visual Language

- **Toolbar**: Floating glassmorphism panel với icon tools
- **Canvas**: Full-screen, infinite, crosshair cursor
- **Dashboard**: Card-based layout, subtle shadows, hover animations
- **Modals**: Smooth Framer Motion scale/fade transitions

---

## 🔑 Quyết định kỹ thuật quan trọng

### Conflict Resolution

**Server-Authoritative với Optimistic UI**:

1. Client áp dụng thay đổi locally ngay lập tức
2. Gửi socket event với `baseVersion` của object
3. Server kiểm tra version conflict
4. Nếu conflict → client rollback về state trước
5. Nếu OK → server broadcast tới tất cả room members

### Canvas State Flow

```
User Action → Zustand UI Store → Konva Render
     ↓
Socket Emit → API/WS Server → Broadcast
     ↓
Socket Receive → Zustand Board Store → Konva Re-render
```

### State Management Phân chia

| Store          | Dữ liệu                                           | Persistence  |
| -------------- | ------------------------------------------------- | ------------ |
| `auth.store`   | user, accessToken                                 | localStorage |
| `board.store`  | objects map, revision, onlineUsers, editingStates | memory only  |
| `ui.store`     | activeTool, selectedIds, clipboard, viewport      | memory only  |
| TanStack Query | board metadata, members, shareLinks               | cache        |

---

## ✅ MVP Completion Criteria

- [ ] Đăng nhập Google OAuth thành công

- [ ] Dashboard hiển thị danh sách boards, tạo board mới

- [ ] Mở board canvas, vẽ shapes (Rect, Circle, Line, Text)

- [ ] Thay đổi sync real-time tới tất cả users trong room

- [ ] Lasso multi-select, undo/redo hoạt động

- [ ] Live cursors của remote users hiển thị

- [ ] Share link hoạt động

- [ ] Permission roles (Owner, Editor, Viewer) được enforce ở UI
