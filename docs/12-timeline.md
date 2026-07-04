# 📅 Timeline — 1-2 Tuần MVP

## Tuần 1 — Core Engine

| Ngày | Plan | Tasks |
|------|------|-------|
| **Ngày 1** (sáng) | 01 - Foundation | Axios client, refresh interceptor, Socket.IO singleton, Zustand stores |
| **Ngày 1** (chiều) | 02 - Auth | Login page UI, Google OAuth flow, route protection middleware |
| **Ngày 2** | 03 - Dashboard | Board list API, BoardGrid, BoardCard, CreateBoardDialog, ShareLinkDialog |
| **Ngày 3** (sáng) | 04 - Canvas Core | Konva Stage, pan, zoom, viewport, dot grid background |
| **Ngày 3** (chiều) | 05 - Shapes | 6 object renderers, ObjectsLayer, inline text editing |
| **Ngày 4** | 06 - Tools | Toolbar UI, tool behaviors, shape creation interactions, StylePanel |
| **Ngày 5** | 07 - Selection | SELECT tool, lasso, Transformer, multi-select, drag/move, keyboard |

## Tuần 2 — Realtime + Polish

| Ngày | Plan | Tasks |
|------|------|-------|
| **Ngày 6** (sáng) | 08 - Realtime | Socket connect/disconnect, board:join, emit all events |
| **Ngày 6** (chiều) | 08 - Realtime | Receive all events, optimistic updates, rollback, reconnect sync |
| **Ngày 7** | 09 - Presence | CursorOverlay, RemoteCursor, PresenceBar, editing awareness |
| **Ngày 8** | 10 - Settings | BoardSettingsPanel, MembersTab, ShareTab, join-by-link flow |
| **Ngày 9** | 11 - Polish | Keyboard shortcuts, themes, error handling, animations, toasts |
| **Ngày 10** | Buffer + QA | Bug fixes, testing, cleanup |

---

## 🏁 Thứ tự implement được gợi ý

```
01 Foundation
    ↓
02 Auth
    ↓
03 Dashboard
    ↓
04 Canvas Core ──┬── 05 Shapes
                 │       ↓
                 └── 06 Tools
                         ↓
                     07 Selection
                         ↓
                     08 Realtime Sync
                         ↓
                 ┌── 09 Presence
                 └── 10 Board Settings
                         ↓
                     11 UX Polish
```
