# 00. Decision Summary

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 - Software Engineer Track  
**Document status:** Draft v0.1  
**Purpose:** Summarize the finalized product and scope decisions before writing detailed architecture, database, API, realtime protocol, and coding-agent documents.

---

## 1. Final Product Direction

The project is a **technical prototype** of a realtime collaborative tactical whiteboard. It allows multiple users to join the same room and collaboratively edit a large virtual canvas used for operation planning or tactical simulation.

The product focuses on four core values:

1. **Realtime multi-user editing**: object changes made by one user are visible to other users in the same room.
2. **Presence awareness**: users can see who is online and where other users are pointing on the canvas.
3. **Persistence and reconnect recovery**: canvas data is stored on the server and can be restored after reload or reconnect.
4. **Conflict-aware collaboration**: the system detects stale object updates using object versions and applies accepted operations in server-defined room revision order.

---

## 2. Product Positioning

| Decision Area | Final Decision |
|---|---|
| Product name | Realtime Collaborative Tactical Whiteboard |
| Context | Operation planning / tactical simulation |
| Tactical meaning | A simulated tactical/operation board with grid background, objects, arrow lines, and text annotations |
| Target users | Operation coordination teams and tactical simulation analysis teams |
| Product maturity | Technical prototype with sufficiently polished UI |
| VDT positioning | Mini project demonstrating software engineering, realtime synchronization, persistence, concurrency handling, and system design |
| Demo target | 3-user role-based demo, tested for 5 users in one room |
| Deployment target | Docker Compose local is mandatory; VPS deployment is a bonus |

---

## 3. Identity and Authentication Decisions

| Area | Final Decision |
|---|---|
| MVP identity | Guest user joins by display name |
| Guest fields | name, avatarColor |
| Auth enhancement | Google OAuth login as should-have |
| Auth token | JWT Bearer token if OAuth is implemented |
| Email/password login | Not included in MVP |
| User profile fields | name, email, avatarUrl, avatarColor |

Rationale: Authentication is not the core scoring factor of this project. The realtime whiteboard must not be delayed by OAuth complexity. Guest identity is enough for the core collaborative demo.

---

## 4. Room and Permission Decisions

| Area | Final Decision |
|---|---|
| Public room | Must-have: users can join by share link containing roomId |
| Private room | Should-have: private room with invite/member check |
| Room list page | Must-have |
| Room metadata | name, description, createdBy, createdAt, updatedAt, currentRevision, isPublic, defaultJoinRole |
| Room deletion | Owner-only; should-have if time is limited |
| Roles | owner, editor, viewer |
| Viewer permission | Can view board, online users, cursors, and object details; cannot edit |
| Editor permission | Can create/update/delete objects, including objects created by others |
| Owner permission | Can edit canvas, delete room, change member role, view history |
| Role management UI | Should-have |

---

## 5. Canvas Decisions

| Area | Final Decision |
|---|---|
| Canvas background | Grid background is must-have |
| Background image | Could-have |
| Real digital map | Won't-have |
| Canvas model | Large virtual canvas with pan/zoom; do not claim true infinite canvas |
| Zoom/pan synchronization | Local only, not synchronized across users |
| Minimap | Won't-have for MVP |
| Object types | rectangle, circle/ellipse, arrow line, text |
| Selection | Single select only |
| Multi-select | Won't-have |
| Group object | Won't-have |
| zIndex | Stored in data model; UI controls are could-have |
| Object lock | Manual lock not included; soft editing indicator is should-have |
| Object detail panel | Must-have; view and edit basic attributes |

Important modeling decision:

- `CIRCLE` should be stored using `width` and `height`, not only `radius`.
- When `width === height`, it behaves as a circle.
- After resizing, it may behave as an ellipse while still satisfying the required circle-like object type.

---

## 6. Interaction Decisions

| Interaction | Final Decision |
|---|---|
| Rectangle/circle creation | Click creates object with default size |
| Line creation | Drag from start point to end point |
| Text creation | Click creates default text; double click edits text |
| Resize/rotate | Konva Transformer |
| Delete | Toolbar/detail panel button and Delete/Backspace key |
| Pan | Hand tool and Space + drag |
| Zoom | Mouse wheel and +/- buttons |
| Snap to grid | Not included |
| Keyboard shortcuts | Not included in MVP, except Delete/Backspace if simple |

---

## 7. Realtime Decisions

| Area | Final Decision |
|---|---|
| Realtime authority | Server authoritative |
| Transport | Socket.IO |
| Broadcast scope | Room-based broadcast |
| Cursor sync | Throttled every 30-50ms |
| Presence | name, avatar/avatarColor, online/offline, cursor position, selected object optional |
| Offline detection | Socket disconnect means offline immediately |
| Reconnect sync | Replay missing operations from `lastSeenRevision`; fallback to full state |
| Drag behavior | Must-have: persist final state on dragend/transformend. Should-have: transient realtime preview during drag/resize |

Transient preview events must not be persisted to the database and must not increase room revision.

---

## 8. Persistence Decisions

| Area | Final Decision |
|---|---|
| Storage model | Store individual objects + operation log |
| Object delete | Soft delete using `deletedAt` |
| Operation history | Persisted in DB |
| Operation history UI | Should-have, latest 50 operations |
| Snapshot | Schema/design included, UI not required |
| Reload recovery | Restore objects and room revision |
| Zoom/pan after reload | Reset is acceptable |
| Selected object after reload | Reset is acceptable |
| Online users after reload | Rebuilt from WebSocket presence |
| Export/import JSON | Could-have or not included |

---

## 9. Conflict Handling Decisions

Final policy:

1. The server uses **object-level version checking** to detect stale updates.
2. If `baseObjectVersion !== current object.version`, the operation is rejected with `OBJECT_VERSION_CONFLICT`.
3. The MVP does not perform field-level merge for stale updates.
4. If an object has been deleted, update operations targeting that object are rejected.
5. Accepted operations are ordered by server-assigned `roomRevision`.
6. Last-write-wins only applies to operations that the server has accepted and ordered.
7. On conflict, the client shows a toast and reloads the latest object state.
8. Soft lock/editing indicator is should-have and acts as a warning, not a hard lock.

---

## 10. Undo/Redo Decisions

| Area | Final Decision |
|---|---|
| Undo/redo | Should-have |
| Scope | Per-user |
| Broadcast behavior | Undo/redo is submitted as a new operation and broadcast to other users |
| Persistence of stack | Undo/redo stack does not need to survive browser reload |
| Operation history | Still persisted in DB |
| Edge case | Undo targeting deleted/outdated object can be rejected by server |

---

## 11. Version History Decisions

| Area | Final Decision |
|---|---|
| Operation log in DB | Must-have |
| History UI | Should-have |
| History UI content | revision, operation type, object type, actor name, createdAt, summary |
| History list size | Latest 50 operations |
| Filter history | Not included |
| Restore old revision | Won't-have |

---

## 12. Non-functional Targets

| Requirement | Target |
|---|---|
| Concurrent users | 5 users in one room for demo/testing |
| Canvas object count | 500 objects |
| Realtime latency | <200ms in local/LAN demo environment |
| Browser support | Chrome + Edge |
| Device target | Desktop only |
| Accessibility | Basic labels, readable contrast, and basic keyboard deletion support |

---

## 13. Technical Stack Decisions

| Layer | Stack |
|---|---|
| Frontend | Next.js, React-Konva, Zustand, shadcn/ui |
| Backend | NestJS, Socket.IO, Prisma |
| Database | PostgreSQL |
| Monorepo | Turborepo |
| Shared contracts | Zod schemas shared between frontend and backend |
| Optional scale component | Redis, not required in initial implementation |
| Local deployment | Docker Compose |
| VPS deployment | Bonus |

---

## 14. Scope Classification

### Must-have

- Guest user join by name
- Create room
- Join room by share link
- Room list page
- Online users
- Cursor realtime
- Draw rectangle
- Draw circle/ellipse
- Draw arrow line
- Draw text
- Select object
- Move object
- Resize object
- Rotate object
- Delete object
- Zoom/pan canvas
- Object detail panel
- Save/load database
- Realtime create/update/delete
- Reconnect synchronization
- Basic role: owner/editor/viewer
- Basic object version conflict detection
- Operation log persistence

### Should-have

- Per-user undo/redo
- Operation history UI, latest 50 operations
- Soft lock / editing indicator
- Realtime transform preview during drag/resize
- Google OAuth login
- Private room invite flow
- Role management UI

### Could-have

- Export/import JSON
- Room snapshot UI
- Background image
- Bring forward/send backward UI
- VPS deployment
- Video demo

### Won't-have

- Full CRDT/Yjs implementation
- Real map tile integration
- Mobile app
- Rich text editor
- Freehand drawing
- Multi-layer advanced editor
- Voice/video/chat realtime
- File upload/image object
- Public production-scale deployment
- Complex audit/security compliance
