# 🗃️ Plan 03 — Dashboard

> **Ưu tiên**: 🔴 Critical  
> **Ước tính**: 1 ngày  
> **Phụ thuộc**: Plan 01, Plan 02

---

## 🎯 Mục tiêu

Xây dựng trang Dashboard để:
1. Hiển thị danh sách boards của user
2. Tạo board mới
3. Tìm kiếm boards
4. Share board bằng link
5. Preview thumbnail của board (nếu có)

---

## 📡 API Integration

Backend endpoints cần dùng:

```
GET  /boards?page=1&limit=20&search=...   → List user's boards
POST /boards { name, description }        → Create board
GET  /boards/:id                          → Board detail
DELETE /boards/:id                        → Delete board (OWNER only)
GET  /boards/:id/share-links              → Get share links
POST /boards/:id/share-links              → Create share link
DELETE /boards/:id/share-links/:linkId    → Revoke share link
```

---

## 📁 Files cần tạo

### `features/board/api/board.api.ts`
```typescript
// createBoard(data: CreateBoardRequest): Promise<BoardResponse>
// listBoards(query: ListBoardsQuery): Promise<ListBoardsResponse>
// getBoardDetail(boardId: string): Promise<BoardDetailResponse>
// updateBoardInfo(boardId, data): Promise<BoardResponse>
// deleteBoard(boardId: string): Promise<void>
// getShareLinks(boardId: string): Promise<BoardShareLinkResponse[]>
// createShareLink(boardId, data): Promise<BoardShareLinkResponse>
// revokeShareLink(boardId, linkId): Promise<void>
// joinBoardByLink(token: string): Promise<BoardDetailResponse>
```

### `features/dashboard/hooks/useBoards.ts`
```typescript
// useBoards(search?: string) → TanStack Query
//   queryKey: ['boards', search]
//   queryFn: boardApi.listBoards({ search })
//   staleTime: 30s

// useCreateBoard() → useMutation
//   onSuccess: invalidate 'boards' query + navigate to new board

// useDeleteBoard() → useMutation
//   onSuccess: invalidate 'boards' query
```

### `features/dashboard/components/BoardCard.tsx`
```tsx
// Card hiển thị một board:
// - Thumbnail (canvas preview hoặc placeholder gradient)
// - Title + description
// - Member count (avatar stack)
// - Created at date
// - Role badge (OWNER / EDITOR / VIEWER)
// - Hover: action buttons (Open, Copy Link, Delete)
// - Click → navigate /board/[boardId]
```

**Design**:
- Ratio: 16:9 thumbnail area
- Subtle border, shadow
- Hover: lift animation (translateY(-2px)), shadow darkens
- Role badge màu: OWNER=violet, EDITOR=blue, VIEWER=gray

### `features/dashboard/components/BoardGrid.tsx`
```tsx
// Grid layout responsive:
// - Desktop: 4 columns
// - Tablet: 3 columns  
// - Mobile: 2 columns (hoặc 1)
// Hiển thị CreateBoardCard ở đầu tiên
// Infinite scroll hoặc "Load More" button
```

### `features/dashboard/components/CreateBoardCard.tsx`
```tsx
// Card đặc biệt để tạo board mới
// Design: dashed border, "+" icon lớn, text "New Board"
// Click → mở CreateBoardDialog
```

### `features/dashboard/components/CreateBoardDialog.tsx`
```tsx
// Dialog (từ components/ui/dialog.tsx)
// Form fields:
//   - Board name (required, max 100 chars)
//   - Description (optional, textarea)
//   - Visibility: Private / Public toggle
// Submit → useCreateBoard mutation
// Loading state trong nút submit
```

### `features/dashboard/components/ShareLinkDialog.tsx`
```tsx
// Dialog quản lý share links
// Hiển thị link hiện tại + copy button
// Nút "Revoke & Regenerate"
// Hiển thị role của link (EDITOR/VIEWER)
```

### `features/dashboard/components/BoardSearch.tsx`
```tsx
// Input search với debounce 300ms
// Clear button
// Update URL search param để preserve state
```

### `features/dashboard/components/DashboardHeader.tsx`
```tsx
// Top header của dashboard:
// - Logo/app name (trái)
// - Search bar (giữa)
// - User avatar + menu (phải): Profile, Settings, Logout
```

### `app/dashboard/page.tsx`
```tsx
// Protected page (requires auth)
// Layout: header + sidebar (future) + main content
// Main: BoardSearch + BoardGrid
// Empty state khi không có boards
```

---

## 🖼️ UI Design Spec — Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ 🎨 RCTW    [      Search boards...      ]    [👤 User ▾] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  My Boards                          [+ New Board]        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐   │
│  │ + New    │  │ [thumb]  │  │ [thumb]  │  │[thumb] │   │
│  │ Board    │  │ Title    │  │ Title    │  │ Title  │   │
│  │          │  │ 3 members│  │ 1 member │  │ ...    │   │
│  │  [----]  │  │ OWNER    │  │ EDITOR   │  │VIEWER  │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘   │
│                                                          │
│  ┌──────────┐  ┌──────────┐                              │
│  │ [thumb]  │  │ [thumb]  │                              │
│  │ ...      │  │ ...      │                              │
│  └──────────┘  └──────────┘                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Board Card Hover State
```
┌──────────────────────────────┐
│  [Gradient thumbnail]         │  ← Hover: overlay với actions
│  ┌──────────────────────────┐ │
│  │ [Open] [Copy Link] [🗑️]  │ │  ← Action bar xuất hiện
│  └──────────────────────────┘ │
│  Project Alpha                │
│  3 members • 2h ago   OWNER  │
└──────────────────────────────┘
```

---

## 🎨 Board Thumbnail Strategy

Vì backend không có thumbnail generation, dùng **placeholder gradients**:
- Mỗi board ID → hash → chọn gradient từ palette 8 màu
- Hiển thị board name lớn ở center
- Khi hover → overlay darkens 30%

---

## 🔔 Empty State

Khi user chưa có board nào:
```
     🎨
  
  No boards yet

  Create your first board to start
  collaborating with your team.

  [Create Board]
```

---

## ✅ Acceptance Criteria

- [ ] Dashboard load danh sách boards từ API
- [ ] Tìm kiếm boards theo tên (debounced)
- [ ] Tạo board mới → xuất hiện trong list ngay
- [ ] Click board → navigate đến `/board/[boardId]`
- [ ] Copy share link hoạt động
- [ ] Empty state khi không có boards
- [ ] User avatar menu → logout hoạt động
- [ ] Role badge hiển thị đúng cho mỗi board
