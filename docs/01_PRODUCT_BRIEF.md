# 01. Product Brief

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 - Software Engineer Track  
**Document status:** Draft v0.1  
**Owner role:** Product Manager / Tech Lead / Solution Architect  
**Timebox:** 5 weeks  

---

## 1. Product Name

**Realtime Collaborative Tactical Whiteboard**

The name directly describes the product scope: a realtime collaborative web whiteboard used for tactical or operation planning scenarios.

---

## 2. Product Summary

Realtime Collaborative Tactical Whiteboard is a web-based collaborative whiteboard that allows multiple users to join the same room and manipulate objects on a shared tactical/operation board in realtime.

The application provides a large virtual canvas with a grid background where users can create and edit basic tactical annotations such as rectangles, circles/ellipses, arrow lines, and text. The system synchronizes object changes, user cursors, and online presence through WebSocket communication. Canvas data is persisted on the server so that reloads or reconnects do not cause data loss.

The project is built as a **technical prototype** for a 5-week software engineering mini project. It prioritizes realtime synchronization, persistence, reconnect recovery, conflict-aware editing, and clear system design over production-grade feature completeness.

---

## 3. Background and Context

In operation planning or tactical simulation, multiple users often need to discuss the same board, point at positions, add annotations, and modify shapes together. If collaboration happens through static screenshots or non-realtime tools, teams face several problems:

1. They cannot edit the same board at the same time.
2. They cannot see where other users are pointing or what others are focusing on.
3. Concurrent edits may overwrite one another without clear conflict handling.
4. Data may be lost after refresh, disconnect, or reconnect.
5. There is limited traceability of who changed what.

This project addresses these problems by building a realtime collaborative board where the server is the source of truth and every persistent object change is recorded as an operation.

---

## 4. Target Users

The primary target users are:

| User Group | Description |
|---|---|
| Operation coordination teams | Users who need to mark positions, routes, zones, or actions on a shared operation board |
| Tactical simulation analysis teams | Users who analyze a simulated tactical scenario and collaborate on map-like diagrams |
| Software engineering reviewers | Reviewers evaluating realtime synchronization, persistence, concurrency handling, and system design quality |

The product is not intended to be a real military-grade tactical system. It is a software engineering prototype that simulates tactical/operation planning workflows.

---

## 5. Problem Statement

Current simple whiteboard or static planning approaches are insufficient for collaborative tactical planning because they often lack robust realtime editing, presence awareness, persistence, and conflict handling.

The project solves the following core problems:

1. **Lack of realtime shared editing**  
   Multiple users cannot reliably edit the same board and immediately see one another's changes.

2. **Lack of presence awareness**  
   Users do not know who is online or where other users are pointing on the canvas.

3. **Risk of concurrent update conflicts**  
   When multiple users edit the same object, later changes may overwrite earlier changes without detection.

4. **Data loss after reload or reconnect**  
   Canvas state may be lost if it exists only in client memory.

---

## 6. Product Goals

| Goal ID | Goal |
|---|---|
| G-01 | Allow multiple users to join the same whiteboard room |
| G-02 | Allow users to create and edit tactical board objects: rectangle, circle/ellipse, arrow line, and text |
| G-03 | Synchronize persistent object changes between users in realtime |
| G-04 | Show online users and remote cursor positions |
| G-05 | Persist canvas state in the database |
| G-06 | Restore canvas state after reload or reconnect |
| G-07 | Detect stale object updates using object versions |
| G-08 | Support basic role-based access control: owner, editor, viewer |
| G-09 | Provide a sufficiently polished desktop UI for demo |
| G-10 | Provide clear technical documentation and reproducible setup instructions |

---

## 7. Non-goals

The project intentionally does not aim to build a production-grade Figma or Miro clone.

The following are out of scope for the MVP:

- Full CRDT/Yjs collaborative data model
- Real map tile integration such as Mapbox or OpenStreetMap
- Mobile app or mobile-first editor
- Rich text editor
- Freehand drawing
- Advanced layer system
- Object grouping and multi-select
- Voice, video, or realtime chat
- File upload or image object as a core feature
- Public production-scale deployment
- Complex audit/security compliance

---

## 8. Value Proposition

The product provides four main values:

| Value | Description |
|---|---|
| Realtime collaboration | Users can edit the same tactical board and see accepted object changes in realtime |
| Presence awareness | Users can see who is online and where other users are pointing |
| Persistence and recovery | Board data is stored in the database and can be recovered after reload or reconnect |
| Conflict-aware editing | The server detects stale object updates and maintains a consistent room revision order |

---

## 9. Key Features

### 9.1 Room Collaboration

- Create a room
- Join a room by share link
- View room list
- Support public room access by link
- Support basic role model: owner, editor, viewer

### 9.2 Canvas Editing

- Grid background
- Large virtual canvas with pan and zoom
- Create rectangle
- Create circle/ellipse
- Create arrow line
- Create text annotation
- Select object
- Move object
- Resize object
- Rotate object
- Delete object
- View and edit object attributes in a detail panel

### 9.3 Realtime Synchronization

- Realtime create/update/delete events
- Room-based WebSocket broadcasting
- Remote cursor display
- Online user list
- Server-authoritative operation acceptance
- Room revision ordering

### 9.4 Persistence and Recovery

- Store individual canvas objects in the database
- Store operation log in the database
- Soft delete objects for history/undo support
- Restore room state after browser reload
- Reconnect synchronization using `lastSeenRevision`

### 9.5 Collaboration Safety

- Object version check for stale updates
- Reject updates targeting deleted objects
- Notify user when an object was updated by another user
- Reload latest object state after conflict

---

## 10. Product Scope by Priority

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

---

## 11. User Roles

| Role | Description |
|---|---|
| Owner | User who creates the room. Can edit the canvas, manage room metadata, manage roles, and delete the room if implemented |
| Editor | User who can create/update/delete canvas objects |
| Viewer | User who can view the board, users, cursors, and object details but cannot edit the board |

---

## 12. Success Metrics

| Metric | Target |
|---|---|
| Concurrent users in one room | 5 users in demo/testing environment |
| Canvas object target | 500 objects |
| Realtime latency | Under 200ms in local/LAN demo environment |
| Browser support | Chrome and Edge |
| Reload recovery | Canvas objects and room revision restored correctly |
| Reconnect recovery | Missing operations replayed or full state restored |
| Role enforcement | Viewer cannot create/update/delete objects |
| Demo scenario | 3 users: owner, editor, viewer |

---

## 13. Product Constraints

| Constraint | Decision |
|---|---|
| Development duration | 5 weeks |
| Main delivery form | Working web demo + source code + report + slides + README |
| Device target | Desktop only |
| Core technical focus | Realtime synchronization, persistence, conflict handling, reconnect recovery |
| Deployment | Docker Compose local is mandatory; VPS is optional |
| Authentication | Guest join is MVP; Google OAuth is enhancement |

---

## 14. Proposed Demo Story

The main demo should simulate a small operation coordination session:

1. Owner creates a room.
2. Editor joins by share link.
3. Viewer joins the same room.
4. Owner draws a zone using rectangle/circle.
5. Editor draws an arrow line and adds a text annotation.
6. All users see object changes in realtime.
7. Users see each other's cursors and online status.
8. Viewer attempts to edit and is blocked.
9. Owner refreshes the browser and the board is restored.
10. Editor reconnects and missing operations are synchronized.
11. A simple conflict scenario is demonstrated using object version detection.
12. Operation history is shown if implemented.

---

## 15. Technical Direction

| Layer | Technology |
|---|---|
| Frontend | Next.js, React-Konva, Zustand, shadcn/ui |
| Backend | NestJS, Socket.IO, Prisma |
| Database | PostgreSQL |
| Monorepo | Turborepo |
| Shared validation/contracts | Zod |
| Local deployment | Docker Compose |
| Optional scaling component | Redis Socket.IO adapter |

---

## 16. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| OAuth consumes too much time | Delays realtime core | Make guest join must-have and OAuth should-have |
| Canvas interaction becomes complex | Delays MVP | Use React-Konva and Konva Transformer |
| Realtime preview during drag causes event spam | Poor performance | Persist only on dragend; preview is throttled and should-have |
| Conflict handling becomes complex | Bugs and inconsistent state | Use object version check + server revision ordering |
| Infinite canvas scope expands | Performance and architecture complexity | Define large virtual canvas, not true infinite canvas |
| Private invite flow expands scope | Timeline risk | Keep public link must-have and private invite should-have |

---

## 17. Product Brief Conclusion

Realtime Collaborative Tactical Whiteboard is a focused 5-week software engineering project centered on realtime collaborative editing. The product should not attempt to become a full production whiteboard platform. Its success depends on delivering a stable, well-designed demo that clearly proves realtime synchronization, server-side persistence, reconnect recovery, basic conflict handling, and role-based collaboration.
