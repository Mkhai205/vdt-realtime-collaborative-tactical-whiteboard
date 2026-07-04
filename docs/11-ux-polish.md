# ✨ Plan 11 — UX Polish: Keyboard Shortcuts, Animations, Error Handling

> **Ưu tiên**: 🟢 Medium  
> **Ước tính**: 0.5 ngày  
> **Phụ thuộc**: Tất cả plans trước

---

## 🎯 Mục tiêu

Hoàn thiện UX với:
1. **Keyboard shortcuts** đầy đủ (giống Excalidraw)
2. **Smooth animations** bằng Framer Motion
3. **Toast notifications** hợp lý
4. **Error boundaries** và loading states
5. **Theme toggle** (Light/Dark)
6. **Undo/Redo UI** (button + history indicator)
7. **Context menu** (right-click)

---

## ⌨️ Keyboard Shortcuts Reference

### Navigation
| Shortcut | Action |
|----------|--------|
| Space + drag | Pan canvas |
| Scroll | Pan vertical |
| Ctrl + Scroll | Zoom in/out |
| Ctrl + = / - | Zoom in/out |
| Ctrl + 0 | Reset zoom 100% |
| Ctrl + Shift + H | Fit objects to view |

### Tools
| Shortcut | Tool |
|----------|------|
| V | SELECT |
| H | HAND |
| R | RECTANGLE |
| C | CIRCLE |
| L | LINE |
| T | TEXT |
| P | PATH |
| I | ICON |
| Escape | Quay về SELECT / Deselect |

### Editing
| Shortcut | Action |
|----------|--------|
| Ctrl + Z | Undo |
| Ctrl + Y / Ctrl + Shift + Z | Redo |
| Ctrl + A | Select all |
| Ctrl + C | Copy |
| Ctrl + V | Paste |
| Ctrl + X | Cut |
| Ctrl + D | Duplicate |
| Delete / Backspace | Delete selected |
| Arrow keys | Nudge 1px |
| Shift + Arrow | Nudge 10px |
| Shift + resize | Keep aspect ratio |

### Board
| Shortcut | Action |
|----------|--------|
| Ctrl + S | Save (force snapshot) |
| Ctrl + Z | Undo |

---

## 🎭 Animation Specs (Framer Motion)

### Page Transitions
```typescript
// Layout transition: /login → /dashboard → /board
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};
// duration: 0.2s ease-out
```

### Panel Animations
```typescript
// BoardSettingsPanel (Sheet) slide từ right:
// initial: translateX(100%)
// animate: translateX(0)
// exit: translateX(100%)
// duration: 0.25s

// Toolbar fade in khi board load:
// initial: opacity 0, translateX(-20px)
// animate: opacity 1, translateX(0)
// duration: 0.3s, delay: 0.1s
```

### Object Creation
```typescript
// Khi object mới xuất hiện trên canvas:
// Konva tween: opacity 0 → 1, scale 0.8 → 1
// duration: 0.15s
```

### Toast Notifications
```typescript
// Dùng Sonner (đã có trong project)
// Vị trí: bottom-right
// Success: auto-dismiss 3s
// Error: auto-dismiss 5s, có close button
// Warning: auto-dismiss 4s

// Toast messages chuẩn:
toast.success('Board created!');
toast.success('Changes saved');
toast.error('Connection lost. Reconnecting...');
toast.error('Update conflict - changes rolled back');
toast.info('Copied to clipboard');
toast.warning('You have viewer access only');
```

---

## 🚨 Error Handling

### Global Error Boundary
```tsx
// Wrap toàn bộ app trong ErrorBoundary
// Catch React rendering errors
// Hiển thị friendly error page
// "Reload page" button
```

### Canvas Error States
```
- Socket disconnect → "Disconnected" banner (bottom of canvas) + retry button
- API error khi load board → Full-page error state
- Permission denied → "You don't have access" page với link về dashboard
- Board not found → 404 page với link về dashboard
```

### Network Error Retry
```typescript
// Axios interceptor: tự retry 1 lần cho network errors (không phải 4xx)
// TanStack Query: retry: 1 cho queries
// Socket: autoReconnect: true, maxAttempts: 5, exponential backoff
```

---

## 🌙 Theme System

### Light Mode (default)
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-canvas: #fafafa;
  --border: #e5e7eb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --accent: #6366f1;
  --accent-light: #e0e7ff;
  --grid-dot: #d1d5db;
}
```

### Dark Mode
```css
.dark {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --bg-canvas: #0f172a;
  --border: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --accent: #818cf8;
  --accent-light: #1e1b4b;
  --grid-dot: #374151;
}
```

### Theme Toggle
```tsx
// Button ở top-right corner (dashboard và board)
// Icon: Sun (light) / Moon (dark)
// next-themes: useTheme hook
// Persist preference in localStorage
```

---

## 🖱️ Context Menu (Right-click)

```tsx
// Right-click trên object:
//   Copy
//   Paste
//   Duplicate (Ctrl+D)
//   ─────
//   Bring to Front
//   Send to Back
//   ─────
//   Delete (Delete)

// Right-click trên empty canvas:
//   Paste
//   Select All
//   ─────
//   Zoom In
//   Zoom Out
//   Reset Zoom

// Implementation: Radix ContextMenu hoặc custom positioned div
```

---

## ⏪ Undo/Redo UI

```tsx
// Trong BoardHeader:
// [↩ Undo (⌘Z)] [↪ Redo (⌘Y)]
//
// Button states:
// - Active: clickable, không disabled
// - Disabled: gray, không thể click (chưa có gì để undo/redo)
//
// Note: Backend quản lý undo/redo history per-user per-board
// Frontend không cần track history, chỉ emit event
// Disabled state: track bằng local counter (số actions kể từ lần cuối undo)
```

---

## 📱 Responsive Considerations

### Tablet (768px – 1024px)
- Toolbar: icons nhỏ hơn (32x32 → 28x28)
- PresenceBar: rút gọn còn 3 avatars
- Settings panel: full width bottom sheet

### Mobile (< 768px)
- Toolbar: bottom bar ngang
- Touch events: pinch-zoom, two-finger pan
- Simplified tool selection
- Note: Full mobile support là stretch goal

---

## 🔔 Loading States

### Board Canvas Loading
```
1. Skeleton overlay với animated pulse
2. Board name loading: "..."
3. Canvas: spinner ở center
4. Sau khi socket connect và board:state received → reveal canvas
```

### Dashboard Loading
```
BoardGrid: skeleton cards (4 placeholder cards)
```

---

## ✅ Acceptance Criteria

- [ ] Ctrl+Z/Y undo/redo hoạt động đúng
- [ ] Delete key xóa selected objects
- [ ] Ctrl+C/V copy/paste objects
- [ ] Ctrl+A select all
- [ ] Theme toggle light/dark hoạt động, persist qua reload
- [ ] Error boundary bắt React errors
- [ ] Socket disconnect hiển thị banner
- [ ] Toast notifications cho success/error/warning
- [ ] Canvas loading state trước khi board:state received
- [ ] Dashboard loading skeleton
- [ ] Context menu right-click hoạt động
