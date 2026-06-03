# 10. 5-Week Delivery Plan

**Project:** Realtime Collaborative Tactical Whiteboard  
**Document version:** v0.1  
**Status:** Draft  

---

## 1. Delivery Strategy

The project will be delivered in 5 weeks. Each week has a clear technical milestone and a demo checkpoint.

The delivery sequence is:

```txt
Foundation -> Canvas -> Persistence -> Realtime -> Recovery/Concurrency -> Polish/Submission
```

Core rule:

```txt
Do not spend excessive time on optional UI polish before realtime + persistence + reconnect are stable.
```

---

## 2. Week 1 - Foundation and Local Canvas

### Objective

Set up the project foundation and build a local-only canvas editor skeleton.

### Target Outcome

By the end of Week 1:

- project runs locally;
- frontend and backend are initialized;
- database is available;
- user can open a whiteboard page;
- grid canvas renders;
- rectangle/circle/line/text can be created locally.

### Planned Scope

| Epic | Feature | Priority |
|---|---|---:|
| E01 | Project foundation and monorepo setup | P0 |
| E02 | Guest identity baseline | P0 |
| E03 | Basic room model and room create/list | P0 |
| E04 | Canvas shell, grid, object rendering | P0 |

### Key Tasks

```txt
T01.01.01 - Create Turborepo workspace
T01.02.01 - Create Next.js app
T01.03.01 - Create NestJS API app
T01.04.01 - Add PostgreSQL Docker service
T02.01.01 - Create guest join form
T02.01.05 - Attach guest identity to REST requests
T03.01.01 - Create Room Prisma model
T03.01.02 - Implement POST /rooms
T04.01.01 - Build whiteboard page layout
T04.01.02 - Render Konva Stage and Layer
T04.01.03 - Add grid background
T04.02.02 - Render rectangle object
T04.02.03 - Render circle/ellipse object
T04.02.04 - Render arrow line object
T04.02.05 - Render text object
T04.03.02 - Click to create rectangle
T04.03.03 - Click to create circle/ellipse
T04.03.04 - Drag to create arrow line
T04.03.05 - Click to create default text
```

### Demo Checkpoint

Open the whiteboard page and create four object types locally.

### Exit Criteria

```txt
[ ] pnpm install works
[ ] frontend runs
[ ] backend runs
[ ] PostgreSQL runs
[ ] Prisma migration works
[ ] guest identity is attached to room API requests
[ ] whiteboard page opens
[ ] grid background renders
[ ] rectangle/circle/line/text render locally
```

---

## 3. Week 2 - Persistence and Object Manipulation

### Objective

Make canvas objects editable and persistent.

### Target Outcome

By the end of Week 2:

- user can select, move, resize, rotate, delete objects;
- object detail panel works;
- objects are saved to PostgreSQL;
- reload restores the canvas.

### Planned Scope

| Epic | Feature | Priority |
|---|---|---:|
| E04 | Selection, transformation, zoom/pan, detail panel | P0 |
| E05 | Object persistence, operation log, room revision | P0 |
| E10 | Initial room state loading | P0 |

### Key Tasks

```txt
T04.04.01 - Implement object selection
T04.04.02 - Show Konva Transformer
T04.04.03 - Move object by drag
T04.04.04 - Resize selected object
T04.04.05 - Rotate selected object
T04.04.06 - Delete object
T04.05.01 - Implement mouse wheel zoom
T04.05.03 - Implement hand tool panning
T04.06.01 - Display selected object details
T04.06.02 - Edit text content from panel
T04.06.03 - Edit color/stroke/style from panel
T05.01.01 - Create WhiteboardObject Prisma model
T05.01.02 - Implement GET /rooms/:roomId/objects
T05.01.03 - Save created object to DB
T05.01.04 - Save updated object to DB
T05.01.05 - Soft delete object
T05.02.01 - Create WhiteboardOperation Prisma model
T05.03.01 - Add currentRevision to Room
T10.01.01 - Load room objects on page open
T10.01.02 - Load current room revision
```

### Demo Checkpoint

Create objects, manipulate them, refresh the page, and verify that all objects reload correctly.

### Exit Criteria

```txt
[ ] selected object shows transformer
[ ] move/resize/rotate/delete work
[ ] object detail panel displays properties
[ ] object style/text can be updated
[ ] object create/update/delete persist to DB
[ ] operation log records changes
[ ] reload restores active objects
[ ] room revision is returned to client
```

---

## 4. Week 3 - Realtime Collaboration

### Objective

Enable multiple users to collaborate in the same room in realtime.

### Target Outcome

By the end of Week 3:

- multiple users can join the same room;
- object create/update/delete syncs to other users;
- online users are visible;
- remote cursors are visible.

### Planned Scope

| Epic | Feature | Priority |
|---|---|---:|
| E06 | Socket connection, room join, object sync | P0 |
| E07 | Online users and cursor realtime | P0 |
| E03 | Basic roles and membership enforcement | P0 |

### Key Tasks

```txt
T06.01.01 - Add Socket.IO Gateway to NestJS
T06.01.02 - Add Socket.IO client to frontend
T06.01.03 - Implement room:join event
T06.01.04 - Return room snapshot on join
T06.02.01 - Implement object:create event
T06.02.02 - Implement object:update event
T06.02.03 - Implement object:delete event
T06.02.04 - Broadcast operation:applied
T06.02.05 - Handle operation:rejected
T06.03.01 - Implement applyOperation in frontend store
T06.03.02 - Prevent duplicate operation using clientOpId
T07.01.01 - Track socket users by room
T07.01.02 - Broadcast presence:update
T07.01.03 - Display online users panel
T07.02.01 - Emit cursor:update
T07.02.02 - Throttle cursor update 30-50ms
T07.02.03 - Broadcast cursor to room except sender
T07.02.04 - Render remote cursors on canvas
```

### Demo Checkpoint

Open the same room in 3 browser windows. Create and manipulate objects as different users. Verify realtime sync and cursor display.

### Exit Criteria

```txt
[ ] socket connects from frontend
[ ] user joins room socket channel
[ ] object create syncs to other clients
[ ] object update syncs to other clients
[ ] object delete syncs to other clients
[ ] online users panel updates
[ ] remote cursors render with user name/color
[ ] events are broadcast only within the same room
```

---

## 5. Week 4 - Recovery, Concurrency, Roles, and Advanced Features

### Objective

Make the collaboration reliable under reconnect and concurrent editing.

### Target Outcome

By the end of Week 4:

- reconnect synchronization works;
- conflict detection works;
- owner/editor/viewer roles are enforced;
- undo/redo baseline works if time allows;
- operation history UI is available if time allows.

### Planned Scope

| Epic | Feature | Priority |
|---|---|---:|
| E08 | Conflict handling and transaction boundary | P0 |
| E10 | Reconnect synchronization | P0 |
| E03 | Role enforcement | P0 |
| E09 | Undo/redo and operation history | P1 |
| E06/E07 | Transform preview and soft lock | P1 |

### Key Tasks

```txt
T08.01.01 - Add version field to WhiteboardObject
T08.01.02 - Require baseObjectVersion in update/delete events
T08.01.03 - Increment object version after update
T08.02.01 - Detect stale object update
T08.02.02 - Reject update to deleted object
T08.02.03 - Return latest object on conflict
T08.02.04 - Show conflict toast on frontend
T08.03.01 - Wrap object update in DB transaction
T08.03.02 - Wrap object delete in DB transaction
T08.03.03 - Add unique constraint for roomId/clientOpId
T10.02.01 - Store lastSeenRevision on client
T10.02.02 - Implement sync:request event
T10.02.03 - Return operations after lastSeenRevision
T10.02.04 - Apply returned operations in order
T10.03.01 - Detect when operation replay is unavailable
T10.03.02 - Return full current state as sync response
T10.03.03 - Replace local state with full snapshot
T09.01.01 - Maintain undo stack in frontend memory
T09.02.04 - Submit undo as new operation
T09.03.01 - Implement GET /rooms/:roomId/operations?limit=50
T09.03.02 - Build operation history panel
```

### Demo Checkpoint

1. User A edits an object.
2. User B sees the update.
3. User B refreshes and state is restored.
4. User C joins as viewer and cannot edit.
5. Two users attempt to edit the same object and conflict handling is demonstrated.

### Exit Criteria

```txt
[ ] viewer cannot create/update/delete objects
[ ] object version conflict is detected
[ ] stale update returns latest object
[ ] deleted object cannot be updated
[ ] object update transaction is atomic
[ ] reconnect sync replays missed operations
[ ] fallback full state sync works
[ ] undo/redo works if P1 completed
[ ] history UI works if P1 completed
```

---

## 6. Week 5 - Stabilization, Packaging, and Final Deliverables

### Objective

Stabilize the demo and prepare the final submission package.

### Target Outcome

By the end of Week 5:

- local Docker Compose works;
- README is complete;
- report and slides are ready;
- demo script is rehearsed;
- known limitations are documented.

### Planned Scope

| Epic | Feature | Priority |
|---|---|---:|
| E11 | Testing and demo preparation | P0 |
| E12 | Docker, README, report, slides | P0 |
| E12 | VPS deployment | P2 |

### Key Tasks

```txt
T11.01.01 - Create manual test checklist
T11.01.02 - Test room create/join flow
T11.01.03 - Test object manipulation flow
T11.01.04 - Test realtime multi-user flow
T11.01.05 - Test reconnect/reload flow
T11.01.06 - Test viewer cannot edit
T11.03.01 - Unit test permission service
T11.03.02 - Unit test operation validation
T11.03.03 - Unit test conflict detection
T11.02.01 - Create seed sample room
T11.02.02 - Prepare 3-user demo script
T11.02.03 - Rehearse demo at least 3 times
T12.01.01 - Add Dockerfile for backend
T12.01.02 - Add Dockerfile for frontend
T12.01.03 - Add Docker Compose for web/api/postgres
T12.02.01 - Write README project overview
T12.02.02 - Write setup instructions
T12.02.03 - Write environment variable documentation
T12.02.04 - Write demo flow instructions
T12.03.01 - Draft technical report outline
T12.03.02 - Fill architecture and synchronization sections
T12.03.03 - Add database and concurrency sections
T12.03.04 - Add results, limitations, future work
T12.03.05 - Create presentation slides
```

### Demo Checkpoint

Run the full demo from a clean environment using README instructions.

### Exit Criteria

```txt
[ ] Docker Compose starts the system
[ ] README can be followed from scratch
[ ] demo room seed data exists
[ ] 3-user demo works reliably
[ ] 5-user basic test is performed
[ ] report is complete
[ ] slides are complete
[ ] known limitations are documented
[ ] source code is ready for submission
```

---

## 7. Scope Control Rule

If Week 3 ends without stable realtime object synchronization, immediately cut or defer:

```txt
- Google OAuth
- private invite UI
- operation history UI
- realtime transform preview
- soft lock indicator
- background image
- VPS deployment
```

If Week 4 ends without stable reconnect and conflict detection, immediately cut or defer:

```txt
- undo/redo
- operation history UI
- role management UI
- export/import JSON
```

Do not cut:

```txt
- room create/join
- object manipulation
- database persistence
- realtime sync
- reconnect recovery
- role enforcement
- conflict detection baseline
```
