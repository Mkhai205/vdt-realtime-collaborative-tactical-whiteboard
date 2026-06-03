# 03. MVP Scope Document

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 - Software Engineer Track  
**Document status:** Draft v0.1  
**Purpose:** Define what will and will not be built in the 5-week MVP.

---

## 1. MVP Principle

The MVP must prove the core technical value of the project:

> Multiple users can collaboratively edit a shared tactical whiteboard in realtime, while the server persists accepted state, restores data after reload/reconnect, and handles basic edit conflicts through object versioning.

The MVP should prioritize:

1. Stable realtime collaboration
2. Reliable persistence
3. Clear state synchronization
4. Basic role enforcement
5. Demonstrable conflict detection
6. Simple but clean desktop UI

The MVP should not attempt to become a full-featured Figma/Miro clone.

---

## 2. Scope Levels

| Scope Level | Meaning |
|---|---|
| Must-have | Required for MVP and final demo |
| Should-have | Important enhancement after MVP is stable |
| Could-have | Optional feature if time remains |
| Won't-have | Explicitly excluded from the 5-week project |

---

## 3. Must-have Scope

### 3.1 User and Room

| ID | Feature | Description | Acceptance Criteria |
|---|---|---|---|
| M-USER-01 | Guest user join by name | User can enter display name and join the application without OAuth. | User identity appears in online list and cursor label. |
| M-ROOM-01 | Create room | User can create a new whiteboard room. | Room has id, name, metadata, currentRevision. |
| M-ROOM-02 | Join room by share link | User can join public room using URL containing roomId. | Joined user receives current room state. |
| M-ROOM-03 | Room list page | User can see rooms. | Rooms are listed with basic metadata. |
| M-ROOM-04 | Public room access | Room can be public by link. | User with room link can join according to defaultJoinRole. |

---

### 3.2 Role and Permission

| ID | Feature | Description | Acceptance Criteria |
|---|---|---|---|
| M-PERM-01 | Basic role model | Support owner/editor/viewer. | Each member has a role. |
| M-PERM-02 | Owner/editor edit permission | Owner and editor can create/update/delete objects. | Server accepts valid edit operations. |
| M-PERM-03 | Viewer read-only permission | Viewer can see board but cannot edit. | Server rejects viewer edit attempts. |
| M-PERM-04 | Server-side permission enforcement | REST and WebSocket operations are checked server-side. | Client cannot bypass role restriction. |

---

### 3.3 Canvas and Object Editing

| ID | Feature | Description | Acceptance Criteria |
|---|---|---|---|
| M-CANVAS-01 | Grid background | Canvas has tactical-style grid background. | Grid visible during pan/zoom. |
| M-CANVAS-02 | Large virtual canvas | Canvas supports pan/zoom over a large coordinate space. | User can move viewport without syncing zoom/pan to others. |
| M-CANVAS-03 | Draw rectangle | User can create rectangle object. | Object appears locally and syncs after server acceptance. |
| M-CANVAS-04 | Draw circle/ellipse | User can create circle object that can be resized into ellipse dimensions. | Object stores width and height. |
| M-CANVAS-05 | Draw arrow line | User can drag from start point to end point to create arrow line. | Line has arrow end. |
| M-CANVAS-06 | Draw text | User can create text annotation. | Text object appears and can be edited. |
| M-CANVAS-07 | Select object | User can select one object at a time. | Selected object shows transformer and detail panel. |
| M-CANVAS-08 | Move object | User can drag object. | Final position is persisted on dragend. |
| M-CANVAS-09 | Resize object | User can resize object. | Final dimensions are persisted on transformend. |
| M-CANVAS-10 | Rotate object | User can rotate object. | Final rotation is persisted on transformend. |
| M-CANVAS-11 | Delete object | User can delete selected object. | Object is soft deleted and disappears from canvas. |
| M-CANVAS-12 | Zoom/pan canvas | User can zoom and pan local viewport. | View changes locally only. |
| M-CANVAS-13 | Object detail panel | User can inspect selected object. | Panel displays object metadata and properties. |
| M-CANVAS-14 | Basic property editing | User can edit basic object properties. | At least text, color, and size-related fields can be edited where applicable. |

---

### 3.4 Realtime Collaboration

| ID | Feature | Description | Acceptance Criteria |
|---|---|---|---|
| M-RT-01 | WebSocket connection | Client connects to backend WebSocket gateway. | Connection state is visible. |
| M-RT-02 | Room-based broadcast | Events are sent only to users in the same room. | Unrelated rooms do not receive events. |
| M-RT-03 | Realtime object create | Created object is synchronized. | Other users see new object. |
| M-RT-04 | Realtime object update | Updated object is synchronized. | Other users see updated position/size/rotation/style. |
| M-RT-05 | Realtime object delete | Deleted object is synchronized. | Other users no longer see deleted object. |
| M-RT-06 | Online users | Room shows online users. | User list updates on join/disconnect. |
| M-RT-07 | Cursor realtime | Remote cursors are shown. | Users see other users' cursor position and label/color. |
| M-RT-08 | Cursor throttling | Cursor events are throttled. | No raw mousemove spam. |
| M-RT-09 | Server-authoritative operations | Persistent changes require server acceptance. | Clients apply accepted operation from server response/broadcast. |

---

### 3.5 Persistence and Recovery

| ID | Feature | Description | Acceptance Criteria |
|---|---|---|---|
| M-DATA-01 | Store objects individually | Each canvas object is stored as a DB record. | Reload loads object records. |
| M-DATA-02 | Store operation log | Accepted persistent operations are stored. | Operation table contains revision and payload. |
| M-DATA-03 | Soft delete object | Delete sets deletedAt. | Deleted objects are excluded from active canvas. |
| M-DATA-04 | Room revision | Room has monotonically increasing currentRevision. | Accepted persistent operation increments revision. |
| M-DATA-05 | Reload recovery | Browser reload restores objects and room revision. | Board is not lost after refresh. |
| M-DATA-06 | Reconnect sync | Client can recover after WebSocket reconnect. | Server returns missing operations or full state. |

---

### 3.6 Conflict Handling

| ID | Feature | Description | Acceptance Criteria |
|---|---|---|---|
| M-CONFLICT-01 | Object version field | Each object has a version number. | Version increases on accepted update. |
| M-CONFLICT-02 | Versioned update request | Update operation includes baseObjectVersion. | Server can detect stale updates. |
| M-CONFLICT-03 | Stale update handling | Server rejects stale conflicting updates. | Client receives rejection and latest object state. |
| M-CONFLICT-04 | Deleted object protection | Server rejects update to deleted object. | Client shows error/toast. |
| M-CONFLICT-05 | Server revision ordering | Accepted operations are ordered by roomRevision. | Clients converge to the same accepted state. |

---

## 4. Should-have Scope

Should-have features are valuable but must not block the MVP.

| ID | Feature | Description | Why It Matters |
|---|---|---|---|
| S-UNDO-01 | Per-user undo/redo | User can undo/redo recent operations in current session. | Good demo and engineering depth. |
| S-HISTORY-01 | Operation history UI | Show latest 50 operations. | Makes operation log visible to reviewers. |
| S-LOCK-01 | Soft lock/editing indicator | Show when another user is editing an object. | Helps explain conflict handling. |
| S-RT-01 | Realtime transform preview | Other users see preview while object is being dragged/resized. | Improves collaboration UX. |
| S-AUTH-01 | Google OAuth login | User can log in with Google. | Improves product completeness. |
| S-ROOM-01 | Private room invite flow | Private room only allows invited/members. | Strengthens permission model. |
| S-PERM-01 | Role management UI | Owner can change member role. | Useful for owner/editor/viewer demo. |

### Should-have Constraints

- Undo/redo stack does not need to survive reload.
- Undo/redo must be submitted as new operations if implemented.
- Transform preview must be transient and not persisted.
- OAuth must not delay realtime, persistence, or reconnect features.

---

## 5. Could-have Scope

Could-have features are optional and should only be implemented after must-have and should-have features are stable.

| ID | Feature | Description |
|---|---|---|
| C-EXPORT-01 | Export/import JSON | Export or import room board data. |
| C-SNAPSHOT-01 | Room snapshot UI | Allow viewing snapshot-related state. |
| C-CANVAS-01 | Background image | Set a background image for the board. |
| C-CANVAS-02 | Bring forward/send backward UI | Change zIndex from UI. |
| C-DEPLOY-01 | VPS deployment | Deploy demo to VPS/domain. |
| C-DEMO-01 | Video demo | Produce 3-5 minute video demo. |

---

## 6. Won't-have Scope

The following features are explicitly excluded from the 5-week MVP.

| ID | Feature | Reason |
|---|---|---|
| W-CRDT-01 | Full CRDT/Yjs implementation | Too complex for 5-week delivery and not required for core demo. |
| W-MAP-01 | Real map tile integration | Would shift focus from collaboration system to map engine. |
| W-MOBILE-01 | Mobile app/mobile-first editor | Canvas editing UX on mobile is expensive. |
| W-TEXT-01 | Rich text editor | Plain text is enough for tactical annotation. |
| W-DRAW-01 | Freehand drawing | Not required by core object list. |
| W-LAYER-01 | Multi-layer advanced editor | Increases editor complexity. |
| W-COMM-01 | Voice/video/chat realtime | Not part of core whiteboard requirement. |
| W-FILE-01 | File upload/image object | Adds storage complexity. |
| W-SCALE-01 | Public production-scale deployment | Docker Compose local is sufficient for submission. |
| W-SEC-01 | Complex audit/security compliance | Not required for academic mini project. |

---

## 7. MVP Demo Scenario

The MVP should support this demo flow:

1. Start application with Docker Compose.
2. User A enters name and creates a room as owner.
3. User B joins room by share link as editor.
4. User C joins room as viewer.
5. User A creates rectangle and text annotation.
6. User B creates arrow line and circle/ellipse.
7. Object changes appear in realtime across users.
8. User cursors and online status are visible.
9. User C attempts to edit an object and is rejected.
10. User A moves/resizes/rotates an object.
11. User B sees the accepted update.
12. User A refreshes browser and the room state is restored.
13. User B disconnects/reconnects and synchronizes missing state.
14. A simple conflict scenario is triggered and shown through toast/latest object reload.
15. Operation history is shown if the should-have UI is implemented.

---

## 8. MVP Data Model Scope

The MVP requires the following core entities:

| Entity | MVP Required | Purpose |
|---|---|---|
| User/GuestUser | Yes | Identify participants |
| Room | Yes | Whiteboard workspace |
| RoomMember | Yes | Store user role in room |
| WhiteboardObject | Yes | Store active and soft-deleted objects |
| WhiteboardOperation | Yes | Store accepted persistent operations |
| RoomSnapshot | Design/schema only | Future sync optimization |

---

## 9. MVP API Scope

### REST API Required

```txt
POST   /rooms
GET    /rooms
GET    /rooms/:roomId
PATCH  /rooms/:roomId
DELETE /rooms/:roomId       # should-have if time-limited
GET    /rooms/:roomId/objects
GET    /rooms/:roomId/operations?limit=50
GET    /rooms/:roomId/members
```

Detailed REST request/response, status code, error, and permission rules are defined in `12_REST_API_CONTRACT.md`.

OAuth endpoints are should-have.

### WebSocket Events Required

```txt
room:join
room:leave
room:state
presence:update
cursor:update
cursor:updated
object:create
object:update
object:delete
operation:applied
operation:rejected
sync:request
sync:response
error
```

Should-have events:

```txt
editing:start
editing:end
object:editing
object:transform-preview
object:transform-previewed
undo:request
redo:request
```

---

## 10. MVP Technical Scope

| Layer | MVP Decision |
|---|---|
| Frontend | Next.js, React-Konva, Zustand, shadcn/ui |
| Backend | NestJS, Socket.IO, Prisma |
| Database | PostgreSQL |
| Monorepo | Turborepo |
| Shared contracts | Zod schemas |
| Runtime | Docker Compose local |
| Optional | Redis adapter, VPS deployment |

---

## 11. Delivery Milestones

### Week 1: Foundation and Local Canvas

- Initialize monorepo
- Setup frontend and backend
- Setup database and Prisma
- Implement room create/list/join basics
- Implement guest user identity
- Render grid canvas
- Create local rectangle/circle/text/line objects

### Week 2: Object Editing and Persistence

- Select/move/resize/rotate/delete objects
- Implement object detail panel
- Save/load objects from database
- Add operation log persistence
- Implement room revision
- Implement basic role enforcement

### Week 3: Realtime Collaboration

- Implement Socket.IO gateway
- Join room over WebSocket
- Broadcast object create/update/delete
- Implement online users
- Implement cursor realtime with throttling
- Multi-tab/multi-user demo

### Week 4: Recovery and Collaboration Safety

- Implement reconnect synchronization
- Implement object version conflict detection
- Implement conflict toast/latest object reload
- Implement viewer edit rejection demo
- Add should-have features if time allows: undo/redo, history UI, soft lock

### Week 5: Polish, Testing, Documentation, Demo

- Fix bugs
- Improve UI/UX
- Prepare Docker Compose run flow
- Write README
- Prepare report and slides
- Prepare seed sample room
- Practice demo script
- Optional VPS deployment/video demo

---

## 12. MVP Acceptance Checklist

```txt
[ ] User can join as guest by name
[ ] User can create room
[ ] User can join room by share link
[ ] User can view room list
[ ] Online users are displayed
[ ] Remote cursors are displayed
[ ] Rectangle can be created
[ ] Circle/ellipse can be created
[ ] Arrow line can be created
[ ] Text can be created and edited
[ ] Object can be selected
[ ] Object can be moved
[ ] Object can be resized
[ ] Object can be rotated
[ ] Object can be deleted
[ ] Canvas can be zoomed and panned
[ ] Object detail panel displays object data
[ ] Basic object attributes can be edited
[ ] Object data is saved to database
[ ] Reload restores objects and room revision
[ ] Object create/update/delete syncs realtime
[ ] WebSocket reconnect restores missing state or full state
[ ] Owner/editor can edit
[ ] Viewer cannot edit
[ ] Object version conflict is detected
[ ] Update to deleted object is rejected
[ ] Operation log is persisted
[ ] Application runs with documented local setup
```

---

## 13. Scope Risk Control

| Risk | Control Decision |
|---|---|
| OAuth delays realtime core | Guest identity is MVP; OAuth is should-have |
| Infinite canvas complexity | Use large virtual canvas, not true infinite canvas |
| Transform preview causes complexity | Persist only final state in MVP; preview is should-have |
| Private invite expands scope | Public by link is MVP; private invite is should-have |
| Undo/redo conflicts with collaboration | Per-user memory-level undo/redo only |
| History UI consumes time | Operation log is must-have; UI is should-have |
| Background image adds upload/storage | Background image is could-have |

---

## 14. MVP Scope Conclusion

The MVP is intentionally scoped to prove the system's core engineering value: realtime collaborative editing with persistence, recovery, role enforcement, and basic conflict handling. Features that improve product polish but increase delivery risk are moved to should-have or could-have. This scope is realistic for a 5-week mini project and strong enough for a technical report and live demo.
