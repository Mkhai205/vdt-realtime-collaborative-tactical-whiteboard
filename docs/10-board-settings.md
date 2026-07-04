# ⚙️ Plan 10 — Board Settings: Members, Share Links, Invitations

> **Ưu tiên**: 🟡 High  
> **Ước tính**: 0.75 ngày  
> **Phụ thuộc**: Plan 02 (Auth), Plan 03 (Dashboard)

---

## 🎯 Mục tiêu

Implement UI quản lý board settings:
1. **Member management**: Xem, thêm, đổi role, xóa members
2. **Share links**: Tạo, copy, revoke invite links
3. **Invitations**: Gửi email invitation
4. **Board settings**: Đổi tên, visibility (Private/Public)
5. **Permission enforcement**: Ẩn/disable UI theo role

---

## 🔑 Permission Matrix

| Action | OWNER | EDITOR | VIEWER |
|--------|-------|--------|--------|
| Xem board | ✅ | ✅ | ✅ |
| Vẽ/edit objects | ✅ | ✅ | ❌ |
| Xem members | ✅ | ✅ | ✅ |
| Thêm/xóa member | ✅ | ✅ | ❌ |
| Đổi member role | ✅ | ❌ | ❌ |
| Tạo share link | ✅ | ✅ | ❌ |
| Revoke share link | ✅ | ✅ | ❌ |
| Gửi invitation | ✅ | ✅ | ❌ |
| Đổi board name/desc | ✅ | ✅ | ❌ |
| Đổi visibility | ✅ | ❌ | ❌ |
| Xóa board | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |

---

## 📁 Files cần tạo

### `features/board/api/member.api.ts`
```typescript
// listMembers(boardId): Promise<ListBoardMembersResponse>
// addMember(boardId, { email, role }): Promise<BoardMemberSummary>
// updateMemberRole(boardId, memberId, { role }): Promise<BoardMemberSummary>
// removeMember(boardId, memberId): Promise<void>
```

### `features/board/api/invitation.api.ts`
```typescript
// createInvitation(boardId, { email, role }): Promise<BoardInvitationResponse>
// listInvitations(boardId): Promise<BoardInvitationResponse[]>
// acceptInvitation({ token }): Promise<BoardDetailResponse>
```

### `features/board/api/share-link.api.ts`
```typescript
// getShareLinks(boardId): Promise<BoardShareLinkResponse[]>
// createShareLink(boardId, { role }): Promise<BoardShareLinkResponse>
// revokeShareLink(boardId, linkId): Promise<void>
// joinByLink({ token }): Promise<BoardDetailResponse>
```

### `features/board/components/BoardSettingsPanel.tsx`
```tsx
// Side panel (sheet) mở từ phải khi click Settings button
// Tabs:
//   1. General (tên, mô tả, visibility)
//   2. Members
//   3. Share & Invite

// Mở bằng Sheet component từ shadcn/radix:
//   trigger: Settings icon button ở header
//   side: right
//   width: 400px
```

### `features/board/components/settings/GeneralTab.tsx`
```tsx
// Form:
//   - Board name (inline edit, auto-save on blur)
//   - Description (textarea, auto-save)
//   - Visibility toggle: Private 🔒 / Public 🌐 (OWNER only)
//   - Danger zone: Delete board button (OWNER only, confirm dialog)
//
// Auto-save pattern:
//   onChange → debounce 500ms → PATCH /boards/:id
//   Show loading spinner trong field khi saving
//   "Saved ✓" indicator sau khi save
```

### `features/board/components/settings/MembersTab.tsx`
```tsx
// Layout:
//   - "Add member" section (EDITOR+): input email + role select + Add button
//   - Member list:
//     [Avatar] [Name/Email] [Role badge] [Actions]
//
// Member row actions (tùy role):
//   - Change role: dropdown (EDITOR/VIEWER) — OWNER only
//   - Remove: trash icon — OWNER only (không remove owner)
//   - Transfer ownership: crown icon — OWNER only
//
// "Add member" form:
//   - Email input
//   - Role select: EDITOR / VIEWER
//   - Add button → POST /boards/:id/members
//   - Loading + error handling
```

### `features/board/components/settings/ShareTab.tsx`
```tsx
// Share Link section:
//   - Hiển thị current share link (với role label)
//   - Copy button (copy full URL)
//   - "Revoke & New Link" button
//
// Email Invitation section:
//   - Email input + role select + Send button
//   - List pending invitations (email, role, expires in)
//   - Revoke pending invitation button
//
// Share link URL format:
//   `${window.location.origin}/join?token={linkToken}`
```

### `features/board/components/BoardHeader.tsx`
```tsx
// Fixed top bar của board canvas:
// [← Back] [Board Name] [Undo] [Redo]     [👥 Presence] [Share] [Settings] [User]
//
// Board name: editable (click để edit, Enter để save) — EDITOR+ only
// Undo/Redo buttons với Ctrl+Z/Y tooltips
// Share button → ShareLinkDialog quick access
// Settings button → mở BoardSettingsPanel
```

---

## 🔗 Join by Link Flow

```
User nhận share link: https://app.com/join?token=xxx
    ↓
/join/page.tsx:
    1. Nếu chưa login → redirect /login?redirect=/join?token=xxx
    2. Nếu đã login → POST /boards/join { token }
    3. Success → redirect /board/[boardId]
    4. Error (link expired, invalid) → error page với link về dashboard
```

### `app/join/page.tsx`
```tsx
// Server component hoặc client với useSearchParams
// Đọc token từ query params
// Gọi joinByLink API
// Redirect phù hợp
```

---

## 📧 Accept Email Invitation Flow

```
User nhận email với link: https://app.com/invitations/accept?token=xxx
    ↓
/invitations/accept/page.tsx:
    1. Nếu chưa login → redirect /login?redirect=/invitations/accept?token=xxx
    2. Nếu đã login → POST /invitations/accept { token }
    3. Success → redirect /board/[boardId]
    4. Error → toast + redirect /dashboard
```

---

## 👁️ Viewer Mode UI

Khi `effectiveRole === VIEWER`:
- Toolbar chỉ hiện SELECT và HAND tools (ẩn shape tools)
- Objects không thể drag/resize (pointer-events: none khi không select)
- "View only" badge ở header
- Tooltip trên disabled tools: "You need Editor role to create shapes"

---

## ✅ Acceptance Criteria

- [ ] Settings panel mở/đóng smoothly
- [ ] General tab: đổi tên board → auto-save trong 500ms
- [ ] Members tab: thêm member bằng email thành công
- [ ] Members tab: OWNER có thể đổi role của EDITOR/VIEWER
- [ ] Members tab: EDITOR không thể thấy role-change actions
- [ ] Share tab: copy share link đúng URL
- [ ] Share tab: revoke link → link cũ không còn hoạt động
- [ ] Share tab: gửi email invitation (success toast)
- [ ] Join by link flow: user vào URL → join board → redirect canvas
- [ ] Viewer mode: shape tools ẩn, canvas readonly
- [ ] Delete board (OWNER): confirm dialog, redirect dashboard sau
