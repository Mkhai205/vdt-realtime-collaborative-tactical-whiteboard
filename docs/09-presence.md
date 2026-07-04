# 👥 Plan 09 — Presence & Live Cursors

> **Ưu tiên**: 🟡 High  
> **Ước tính**: 0.5 ngày  
> **Phụ thuộc**: Plan 08 (Realtime Sync)

---

## 🎯 Mục tiêu

1. **Live Cursors**: Hiển thị con trỏ của remote users trên canvas
2. **Presence Bar**: Danh sách avatars của users đang online
3. **Editing Awareness**: Highlight object đang được edit bởi người khác
4. **Follow mode** (optional): Click avatar → viewport theo user đó

---

## 🏗️ Cursor Overlay Architecture

Remote cursors **không** render trong Konva (để tránh re-render canvas).  
Thay vào đó, render bằng **absolute-positioned HTML divs** trên canvas:

```
┌─── Canvas Stage ──────────────────────────────┐
│                                                │
│  [HTML cursor overlay - pointer-events: none]  │
│  ┌─────────────────────────────────────────┐   │
│  │                                          │   │
│  │    👆 Alice (moves in world coords)      │   │
│  │                                          │   │
│  │           👆 Bob                         │   │
│  └─────────────────────────────────────────┘   │
│                                                │
└────────────────────────────────────────────────┘
```

**Convert world coords → screen coords**:
```typescript
screenX = (worldX * scale) + stageX
screenY = (worldY * scale) + stageY
```

---

## 📁 Files cần tạo

### `features/cursor/components/CursorOverlay.tsx`
```tsx
// Absolute div phủ toàn bộ canvas
// pointer-events: none (không chặn canvas events)
// z-index: cao hơn canvas
// Render RemoteCursor cho mỗi user có cursor position

interface RemoteCursorData {
  userId: string;
  name: string;
  avatarUrl?: string;
  avatarColor: string;
  x: number;  // world coordinates
  y: number;
}
```

### `features/cursor/components/RemoteCursor.tsx`
```tsx
// Individual cursor component:
// - Cursor icon SVG (giống Excalidraw: mũi tên chuột)
// - Name label bên cạnh
// - Background color = user.avatarColor
//
// Styling:
//   - position: absolute
//   - transform: translate(screenX, screenY)
//   - transition: transform 80ms ease-out (smooth movement)
//   - font-size: 12px, font-weight: 600
//   - padding: 3px 6px, border-radius: 4px
//   - color: white, background: avatarColor
//
// Nếu cursor out of viewport: hide (position > stage bounds)
```

### `features/cursor/hooks/useCursorSync.ts`
```typescript
// 1. Emit cursor position:
//    - Stage onMouseMove → throttle 50ms → emit cursor:move { boardId, worldX, worldY }
//    - Stage onMouseLeave → stop emitting
//
// 2. Receive remote cursors:
//    - Subscribe cursor:moved events
//    - Update cursor store: Map<userId, CursorData>
//    - Auto-remove cursor after 3s inactivity (debounce)
```

### `features/cursor/store/cursor.store.ts`
```typescript
interface CursorStore {
  cursors: Map<string, RemoteCursorData>;  // userId → cursor
  updateCursor: (userId: string, data: CursorMoveData) => void;
  removeCursor: (userId: string) => void;
}
// Không persist
```

### `features/presence/components/PresenceBar.tsx`
```tsx
// Top-right corner của canvas header:
//
// [👤 Alice] [👤 Bob] [👤 Charlie] +2
//
// Mỗi avatar:
//   - Hình tròn với avatarColor hoặc avatarUrl
//   - Tooltip: tên user
//   - Border màu nếu user đang editing object
//   - Hover: "Follow" button (optional)
//
// Nếu > 5 users: show "+N" badge
// Animated: fade-in khi user join, fade-out khi leave
```

### `features/presence/components/UserAvatar.tsx`
```tsx
// Reusable avatar component:
// Props: user (UserSummary), size ('sm'|'md'|'lg'), showName?
//
// Priority:
//   1. avatarUrl → <img>
//   2. name initials (first letter of first + last name)
//   3. Fallback: generic user icon
//
// Background: user.avatarColor
```

### `features/presence/hooks/usePresence.ts`
```typescript
// Sync presence state:
//
// Subscribe presence:update events:
//   - USER_JOINED → add to onlineUsers list
//   - USER_LEFT → remove from onlineUsers + remove cursor
//
// Return: { onlineUsers, currentUser }
```

---

## 🎨 Editing Awareness UI

Khi `editingStates` store chứa `objectId → {userId, userName}`:

```tsx
// Trong ObjectRenderer, check if object is being edited:
const editingEntry = editingStates.get(object.id);
const isEditedByOther = editingEntry && editingEntry.userId !== currentUser.id;

// Nếu isEditedByOther:
//   - Render dashed border màu avatarColor của editor
//   - Small avatar badge ở top-right corner của object
//   - Konva không có CSS, nên dùng custom Rect overlay
```

**Visual Spec**:
```
┌ - - - - - - - - ┐  ← dashed border (blue = Alice's color)
|                  |  [👤 Alice]  ← name badge
|   [Shape]        |
|                  |
└ - - - - - - - - ┘
```

---

## 🎯 User Avatar Color System

```typescript
// avatarPalette từ shared-contracts:
export const avatarPalette = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#6366f1', // violet (app accent)
  '#ec4899', // pink
  '#8b5cf6', // purple
];

// Assign màu khi user register (random từ palette)
// Consistent: same user always has same color
```

---

## 📊 Presence Stats (Optional Enhancement)

```tsx
// Board header thêm:
// "3 people editing" / "You're the only one here"
// Khi > 10 users: "10+ people in this board"
```

---

## ✅ Acceptance Criteria

- [ ] Khi User B di chuyển chuột → User A thấy cursor của B di chuyển smooth
- [ ] Cursor label hiển thị đúng tên user
- [ ] Cursor dùng màu avatar của từng user
- [ ] Cursor out of viewport → ẩn đi
- [ ] Cursor inactivity 3s → ẩn
- [ ] PresenceBar hiển thị tất cả users đang online
- [ ] User join → avatar xuất hiện PresenceBar (animate in)
- [ ] User leave → avatar biến mất PresenceBar (animate out)
- [ ] Object đang được edit bởi người khác → dashed border + name badge
- [ ] Tooltip khi hover avatar trong PresenceBar
