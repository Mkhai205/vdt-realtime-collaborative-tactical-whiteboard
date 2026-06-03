# 02. Software Requirements Specification

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 - Software Engineer Track  
**Document status:** Draft v0.1  
**Purpose:** Define functional and non-functional requirements before architecture and implementation.

---

## 1. Overview

Realtime Collaborative Tactical Whiteboard is a web application that allows multiple users to collaborate on a shared tactical/operation board in realtime. Users join a room, draw and edit objects on a large virtual canvas, see other users' cursors and online status, and recover board data after reload or reconnect.

The system uses a server-authoritative synchronization model. Clients send operations to the server. The server validates permission and object versions, persists accepted operations, assigns room revisions, and broadcasts accepted operations to users in the same room.

---

## 2. Requirement Priority Definitions

| Priority | Meaning |
|---|---|
| Must-have | Required for the MVP and final demo |
| Should-have | Important enhancement; implement after core MVP is stable |
| Could-have | Optional feature if time remains |
| Won't-have | Explicitly out of scope for the 5-week project |

---

## 3. Actors

| Actor | Description |
|---|---|
| Guest User | User who joins by entering a display name |
| Authenticated User | User who logs in through Google OAuth, if implemented |
| Owner | Room creator with highest permission |
| Editor | Room member who can modify canvas objects |
| Viewer | Room member who can view board state but cannot modify objects |
| System | Backend server responsible for validation, persistence, synchronization, and conflict handling |

---

## 4. Functional Requirements

### 4.1 Identity and User Session

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-USER-01 | The system shall allow a guest user to join the application by entering a display name. | Must-have | User can enter a name and receive a temporary user identity for room collaboration. |
| FR-USER-02 | The system shall assign an avatar color to each user. | Must-have | User appears in presence/cursor UI with a stable color during the session. |
| FR-USER-03 | The system should support Google OAuth login. | Should-have | User can log in with Google and obtain an authenticated identity. |
| FR-USER-04 | If OAuth is implemented, the system shall issue a JWT Bearer token for API and WebSocket authorization. | Should-have | Frontend can call protected API and connect WebSocket using the token. |
| FR-USER-05 | The system shall not require email/password login in the MVP. | Won't-have | No email/password registration or login is required. |

---

### 4.2 Room Management

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-ROOM-01 | The system shall allow a user to create a room. | Must-have | A room can be created with name and optional description. |
| FR-ROOM-02 | The system shall allow a user to view a list of rooms. | Must-have | User can see available rooms in a room list page. |
| FR-ROOM-03 | The system shall allow users to join a public room by share link containing roomId. | Must-have | Opening the room URL allows joining the room. |
| FR-ROOM-04 | The system shall store room metadata. | Must-have | Room stores name, description, createdBy, createdAt, updatedAt, currentRevision, isPublic, defaultJoinRole. |
| FR-ROOM-05 | The system shall keep canvas data after all users leave a room. | Must-have | Rejoining the room later restores stored objects. |
| FR-ROOM-06 | The system should support private room access where only invited or existing members can join. | Should-have | Private rooms reject users who are not members or invited. |
| FR-ROOM-07 | The system should allow the owner to delete a room. | Should-have | Deleted room is no longer accessible. |
| FR-ROOM-08 | The system should allow the owner to change member roles. | Should-have | Owner can change editor/viewer roles. |

---

### 4.3 Role and Permission

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-PERM-01 | The system shall support owner, editor, and viewer roles. | Must-have | Each room member has exactly one role. |
| FR-PERM-02 | The system shall allow owner and editor to create canvas objects. | Must-have | Owner/editor can create rectangle, circle/ellipse, arrow line, and text. |
| FR-PERM-03 | The system shall allow owner and editor to update canvas objects. | Must-have | Owner/editor can move, resize, rotate, and update object attributes. |
| FR-PERM-04 | The system shall allow owner and editor to delete canvas objects. | Must-have | Owner/editor can delete objects, including objects created by others. |
| FR-PERM-05 | The system shall prevent viewer from modifying objects. | Must-have | Viewer edit requests are rejected by the server. |
| FR-PERM-06 | The system shall allow viewer to see canvas, online users, cursors, and object detail. | Must-have | Viewer receives realtime updates and can inspect objects. |
| FR-PERM-07 | The server shall enforce permission for REST and WebSocket operations. | Must-have | Client-side role checks are not the only enforcement layer. |

---

### 4.4 Canvas and Object Editing

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CANVAS-01 | The system shall provide a large virtual canvas with grid background. | Must-have | Users can pan/zoom over a large coordinate space with visible grid. |
| FR-CANVAS-02 | The system shall allow local zoom and pan. | Must-have | Zoom/pan affects only the local user's viewport. |
| FR-CANVAS-03 | The system shall allow users to create rectangle objects. | Must-have | Clicking with rectangle tool creates a default rectangle. |
| FR-CANVAS-04 | The system shall allow users to create circle/ellipse objects. | Must-have | Clicking with circle tool creates a default circle; resizing can produce ellipse-like dimensions. |
| FR-CANVAS-05 | The system shall allow users to create arrow line objects. | Must-have | Dragging from start point to end point creates a line with arrow end. |
| FR-CANVAS-06 | The system shall allow users to create text objects. | Must-have | Clicking with text tool creates default text; double click edits text. |
| FR-CANVAS-07 | The system shall allow users to select one object at a time. | Must-have | Clicking an object selects it and shows transformer/detail panel. |
| FR-CANVAS-08 | The system shall allow users to move selected objects. | Must-have | Dragging selected object changes its position. |
| FR-CANVAS-09 | The system shall allow users to resize selected objects. | Must-have | Konva Transformer or equivalent handles resize. |
| FR-CANVAS-10 | The system shall allow users to rotate selected objects. | Must-have | Transformer or rotation handle changes object rotation. |
| FR-CANVAS-11 | The system shall allow users to delete selected objects. | Must-have | Delete button and Delete/Backspace key remove selected object. |
| FR-CANVAS-12 | The system shall show object detail when an object is selected. | Must-have | Detail panel shows type, position, size, rotation, style, version, and metadata. |
| FR-CANVAS-13 | The system shall allow editing basic object attributes from the detail panel. | Must-have | User can update at least text, color, and size-related fields where applicable. |
| FR-CANVAS-14 | The system may support background image. | Could-have | User can set a background image if implemented. |
| FR-CANVAS-15 | The system may support bring forward/send backward UI. | Could-have | User can change zIndex through UI if implemented. |
| FR-CANVAS-16 | The system shall not implement real map tile integration. | Won't-have | No Mapbox/OpenStreetMap tile engine. |
| FR-CANVAS-17 | The system shall not implement multi-select or grouping in MVP. | Won't-have | Only single object selection is supported. |
| FR-CANVAS-18 | The system shall not implement freehand drawing. | Won't-have | Only the required object types are supported. |

---

### 4.5 Realtime Collaboration

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-RT-01 | The system shall use WebSocket communication for realtime collaboration. | Must-have | Clients connect to the backend WebSocket gateway. |
| FR-RT-02 | The system shall broadcast accepted object create/update/delete operations to users in the same room. | Must-have | Other users see object changes without manual refresh. |
| FR-RT-03 | The system shall use room-based broadcast. | Must-have | Events are not broadcast to unrelated rooms. |
| FR-RT-04 | The system shall use the server as the authoritative source of accepted state. | Must-have | Persistent operations are accepted, rejected, ordered, and broadcast by the server. |
| FR-RT-05 | The system shall synchronize remote cursor positions. | Must-have | Users can see other users' cursor positions on the canvas. |
| FR-RT-06 | Cursor updates shall be throttled. | Must-have | Cursor updates are sent approximately every 30-50ms, not on every raw mousemove. |
| FR-RT-07 | The system shall display online users. | Must-have | User list updates when users join or disconnect. |
| FR-RT-08 | The system should show which object a user is currently editing. | Should-have | Other users see an editing indicator or warning. |
| FR-RT-09 | The system should support transient transform preview during drag/resize. | Should-have | Other users can see preview movement, but preview is not persisted. |
| FR-RT-10 | The final object state shall be persisted only when manipulation ends. | Must-have | Dragend/transformend emits a persistent update operation. |

---

### 4.6 Persistence and Recovery

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DATA-01 | The system shall store canvas objects individually in the database. | Must-have | Each object has its own persistent record. |
| FR-DATA-02 | The system shall store operation logs in the database. | Must-have | Accepted persistent operations are recorded with revision and payload. |
| FR-DATA-03 | The system shall soft delete objects. | Must-have | Deleted objects have deletedAt rather than immediate hard deletion. |
| FR-DATA-04 | The system shall restore room objects and room revision after browser reload. | Must-have | User reloads room and sees stored objects. |
| FR-DATA-05 | The system shall support reconnect synchronization. | Must-have | Client sends lastSeenRevision and receives missing operations or full state. |
| FR-DATA-06 | The system shall fallback to full state synchronization if operation replay is not possible. | Must-have | Client receives current objects and current roomRevision. |
| FR-DATA-07 | The system should include snapshot schema/design. | Should-have | Database schema or design accounts for room snapshots. |
| FR-DATA-08 | The system may implement export/import JSON. | Could-have | User can export/import room data if time remains. |

---

### 4.7 Conflict Handling

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CONFLICT-01 | The system shall include an object version field. | Must-have | Each object has a version number. |
| FR-CONFLICT-02 | Update operations shall include baseObjectVersion. | Must-have | Client sends the object version it edited from. |
| FR-CONFLICT-03 | The server shall detect stale updates. | Must-have | If baseObjectVersion is outdated, the server can reject or resolve according to policy. |
| FR-CONFLICT-04 | The server shall reject updates targeting deleted objects. | Must-have | Client receives operation rejection. |
| FR-CONFLICT-05 | Accepted operations shall be ordered by roomRevision. | Must-have | Each accepted persistent operation has a monotonically increasing room revision. |
| FR-CONFLICT-06 | The client shall notify the user when a stale update is rejected. | Must-have | Toast or message says the object was updated by another user. |
| FR-CONFLICT-07 | The client shall reload latest object state after conflict rejection. | Must-have | Client state becomes consistent with server state. |
| FR-CONFLICT-08 | The system should show soft lock/editing indicator. | Should-have | Users are warned when another user is editing an object. |

---

### 4.8 Undo/Redo

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-UNDO-01 | The system should support per-user undo. | Should-have | User can undo their recent operation in the current session. |
| FR-UNDO-02 | The system should support per-user redo. | Should-have | User can redo an undone operation in the current session. |
| FR-UNDO-03 | Undo/redo shall be submitted as new operations. | Should-have | Other users receive undo/redo effect through realtime broadcast. |
| FR-UNDO-04 | Undo/redo stack does not need to persist after reload. | Should-have | Stack may be kept in client memory only. |
| FR-UNDO-05 | Server may reject undo/redo if target object is deleted or stale. | Should-have | Client shows error if undo cannot be applied. |

---

### 4.9 Version History

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-HISTORY-01 | The system shall persist operation history. | Must-have | Operation logs are stored in DB. |
| FR-HISTORY-02 | The system should show latest 50 operations in UI. | Should-have | User can view operation type, actor, object type, revision, createdAt, and summary. |
| FR-HISTORY-03 | The system shall not support restoring to old revisions in MVP. | Won't-have | History is read-only. |
| FR-HISTORY-04 | The system shall not require filtering history by object or user. | Won't-have | Latest operations list is enough. |

---

## 5. Non-functional Requirements

### 5.1 Performance

| ID | Requirement | Target | Priority |
|---|---|---|---|
| NFR-PERF-01 | The system shall support concurrent users in one room. | 5 users | Must-have |
| NFR-PERF-02 | The system shall support a reasonable number of canvas objects. | 500 objects | Must-have |
| NFR-PERF-03 | Realtime operation latency should be acceptable for demo. | <200ms in local/LAN environment | Must-have |
| NFR-PERF-04 | Cursor events shall be throttled. | 30-50ms | Must-have |
| NFR-PERF-05 | Drag/resize/rotate shall not persist every pixel movement. | Persist final state on interaction end | Must-have |

---

### 5.2 Reliability and Recovery

| ID | Requirement | Target | Priority |
|---|---|---|---|
| NFR-REL-01 | Browser reload shall not lose canvas data. | Objects and roomRevision restored | Must-have |
| NFR-REL-02 | WebSocket reconnect shall recover state. | Operation replay or full sync fallback | Must-have |
| NFR-REL-03 | Server shall not trust client permissions. | Server-side permission validation | Must-have |
| NFR-REL-04 | Server shall reject invalid operation payloads. | Validation before persistence | Must-have |

---

### 5.3 Compatibility

| ID | Requirement | Target | Priority |
|---|---|---|---|
| NFR-COMP-01 | Browser support | Chrome and Edge | Must-have |
| NFR-COMP-02 | Device target | Desktop only | Must-have |
| NFR-COMP-03 | Mobile responsive editor | Not required | Won't-have |

---

### 5.4 Security and Authorization

| ID | Requirement | Target | Priority |
|---|---|---|---|
| NFR-SEC-01 | Edit operations shall be restricted by role. | Viewer cannot edit | Must-have |
| NFR-SEC-02 | WebSocket events shall validate room membership. | User must be allowed to join/edit room | Must-have |
| NFR-SEC-03 | Private room access shall be enforced if private room is implemented. | Non-members rejected | Should-have |
| NFR-SEC-04 | OAuth shall use secure token handling if implemented. | JWT Bearer token | Should-have |

---

### 5.5 Usability

| ID | Requirement | Target | Priority |
|---|---|---|---|
| NFR-UX-01 | The UI shall be sufficiently polished for demo. | Clean desktop layout | Must-have |
| NFR-UX-02 | The system shall show connection state. | connected/disconnected/reconnecting | Must-have |
| NFR-UX-03 | The system shall show user-friendly errors for conflicts and permission denial. | Toast/message | Must-have |
| NFR-UX-04 | The system shall provide basic accessibility. | readable contrast, labels, basic Delete key | Should-have |

---

## 6. Data Requirements

### 6.1 Room Data

Room must include:

- id
- name
- description
- createdById
- createdAt
- updatedAt
- currentRevision
- isPublic
- defaultJoinRole

### 6.2 User Data

Guest user should include:

- id
- name
- avatarColor
- isGuest

Authenticated user should include:

- id
- name
- email
- avatarUrl
- avatarColor

### 6.3 Object Data

All objects should include common fields:

- id
- roomId
- type
- x
- y
- width
- height
- rotation
- fill
- stroke
- strokeWidth
- opacity
- zIndex
- version
- createdById
- updatedById
- deletedAt
- createdAt
- updatedAt

Line object additionally includes:

- points
- arrowStart
- arrowEnd

Text object additionally includes:

- text
- fontSize
- fontColor

### 6.4 Operation Data

Operation log should include:

- id
- clientOpId
- roomId
- actorId
- revision
- type
- objectId
- baseObjectVersion
- payload
- inversePayload optional
- createdAt

---

## 7. System Boundary

### In Scope

- Web frontend
- Backend REST API
- Backend WebSocket gateway
- PostgreSQL persistence
- Docker Compose local runtime
- Shared schemas/contracts
- Basic technical documentation

### Out of Scope

- Production-grade scaling
- Real-time media communication
- Full CRDT collaborative editing
- Real map tile rendering
- Mobile-first UX
- External file storage as required feature

---

## 8. Acceptance Criteria Summary

The MVP is accepted when the following scenario works reliably:

1. User A creates a room.
2. User B joins via share link.
3. User C joins as viewer.
4. Users see online user list.
5. Users see remote cursors.
6. Owner/editor can create rectangle, circle/ellipse, arrow line, and text.
7. Owner/editor can move, resize, rotate, and delete objects.
8. Viewer cannot modify objects.
9. Changes are synchronized to other users in realtime.
10. Canvas data is persisted in the database.
11. Browser reload restores objects and room revision.
12. Reconnect synchronizes missing updates or reloads full state.
13. Server detects stale object updates and rejects invalid conflicts.
14. Operation logs are persisted.
15. Application can run locally through documented setup.

---

## 9. Open Questions

The following items can be decided later without blocking the MVP:

1. Whether to implement Google OAuth within the 5-week deadline.
2. Whether private invite flow will include invite tokens or direct member addition only.
3. Whether operation history UI will be included in the final demo.
4. Whether transient realtime transform preview will be implemented after stable dragend persistence.
5. Whether VPS deployment will be completed or only Docker Compose local will be provided.

---

## 10. Requirement Specification Conclusion

This SRS defines a focused realtime collaborative whiteboard MVP. The system emphasizes reliable collaboration, server-authoritative synchronization, database persistence, reconnect recovery, and basic conflict handling. Features that increase scope but do not directly strengthen the core demo are classified as should-have or could-have.
