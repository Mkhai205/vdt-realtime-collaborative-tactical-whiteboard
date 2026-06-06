# 09. Epic - Feature - Task Breakdown

**Project:** Realtime Collaborative Tactical Whiteboard  
**Document version:** v0.1  
**Status:** Draft  

---

## 1. Overview

This document breaks the project into Epics, Features, and Tasks. It is the main execution backlog for implementation and coding-agent coordination.

Priority legend:

| Priority | Meaning |
|---|---|
| P0 | Critical MVP |
| P1 | Important should-have |
| P2 | Bonus could-have |
| P3 | Explicitly out of scope |

Status legend:

```txt
Backlog | Ready | In Progress | Review | Testing | Done | Blocked
```

---

# E01. Project Foundation and Monorepo Setup

## Goal

Set up the technical foundation for frontend, backend, shared contracts, database, and local development.

## Features and Tasks

### F01.01 - Initialize monorepo

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T01.01.01 | Create Turborepo workspace | P0 | None | Repo has `apps/web`, `apps/api`, `packages/shared` |
| T01.01.02 | Configure pnpm workspace | P0 | T01.01.01 | `pnpm install` works from root |
| T01.01.03 | Add root scripts for dev/build/lint/typecheck | P0 | T01.01.02 | Root scripts can run web/api commands |
| T01.01.04 | Add base TypeScript config | P0 | T01.01.01 | Shared strict TypeScript settings exist |

### F01.02 - Initialize frontend app

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T01.02.01 | Create Next.js app | P0 | F01.01 | App runs locally |
| T01.02.02 | Install and configure Tailwind + shadcn/ui | P0 | T01.02.01 | Basic UI component renders |
| T01.02.03 | Install React-Konva and Konva | P0 | T01.02.01 | Canvas component can render a stage |
| T01.02.04 | Install Zustand | P0 | T01.02.01 | Store can be created and used |

### F01.03 - Initialize backend app

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T01.03.01 | Create NestJS API app | P0 | F01.01 | API starts locally |
| T01.03.02 | Configure global validation and error response format | P0 | T01.03.01 | Invalid request returns consistent error |
| T01.03.03 | Add health check endpoint | P0 | T01.03.01 | `GET /health` returns OK |
| T01.03.04 | Configure CORS for frontend | P0 | T01.03.01 | Frontend can call backend |

### F01.04 - Configure database and Prisma

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T01.04.01 | Add PostgreSQL service to Docker Compose | P0 | None | DB container starts |
| T01.04.02 | Install and configure Prisma | P0 | T01.03.01 | Prisma client can connect |
| T01.04.03 | Create initial Prisma schema | P0 | T01.04.02 | First migration runs |
| T01.04.04 | Add seed script for demo users and sample room | P1 | T01.04.03 | Seed data is inserted successfully |

---

# E02. Identity and Access Foundation

## Goal

Allow users to join rooms and identify themselves in realtime collaboration. Guest identity is MVP; Google OAuth is an enhancement.

## Features and Tasks

### F02.01 - Guest identity

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T02.01.01 | Create guest join form with display name | P0 | F01.02 | User can enter a name before joining room |
| T02.01.02 | Generate avatarColor for guest users | P0 | T02.01.01 | User has consistent color in session |
| T02.01.03 | Store guest session in localStorage | P0 | T02.01.01 | Refresh preserves guest identity |
| T02.01.04 | Send guest identity during socket connection | P0 | T02.01.03 | Server can identify socket user |
| T02.01.05 | Attach guest identity to REST requests | P0 | T02.01.03 | Server can resolve actor for room APIs |

### F02.02 - Google OAuth login

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T02.02.01 | Configure Google OAuth credentials | P1 | F01.03 | OAuth credentials are loaded from env |
| T02.02.02 | Implement Google OAuth callback | P1 | T02.02.01 | Login creates or finds user |
| T02.02.03 | Issue JWT Bearer token | P1 | T02.02.02 | Frontend receives usable access token |
| T02.02.04 | Attach JWT to REST and WebSocket requests | P1 | T02.02.03 | Authenticated user can join room |

---

# E03. Room Management and Membership

## Goal

Support room creation, room listing, joining by link, basic membership, and role enforcement.

## Features and Tasks

### F03.01 - Room CRUD

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T03.01.01 | Create Room Prisma model | P0 | F01.04 | Room table exists |
| T03.01.02 | Implement `POST /rooms` | P0 | T03.01.01 | User can create room |
| T03.01.03 | Implement `GET /rooms` | P0 | T03.01.01 | User can view room list |
| T03.01.04 | Implement `GET /rooms/:roomId` | P0 | T03.01.01 | Room detail can be loaded |
| T03.01.05 | Implement `DELETE /rooms/:roomId` owner-only | P1 | F03.02 | Owner can delete room |

### F03.02 - Room membership and roles

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T03.02.01 | Create RoomMember Prisma model | P0 | T03.01.01 | Membership table exists |
| T03.02.02 | Add roles OWNER/EDITOR/VIEWER | P0 | T03.02.01 | Role enum exists |
| T03.02.03 | Assign creator as OWNER | P0 | T03.01.02 | Creator becomes room owner |
| T03.02.04 | Implement public join by link | P0 | T03.02.01 | Guest/user can join public room |
| T03.02.05 | Apply defaultJoinRole when joining | P0 | T03.02.04 | New member gets correct role |
| T03.02.06 | Implement role check service | P0 | T03.02.02 | Server can check edit permission |

### F03.03 - Private room and invite flow

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T03.03.01 | Add `isPublic` to room | P0 | T03.01.01 | Room can be public/private |
| T03.03.02 | Reject non-member joining private room | P1 | T03.03.01 | Private room cannot be joined directly |
| T03.03.03 | Implement simple direct userId invite member endpoint | P1 | T03.02 | Owner can add existing user as member |
| T03.03.04 | Build member management UI | P1 | T03.03.03 | Owner can view/change roles |

---

# E04. Canvas Rendering and Local Interaction

## Goal

Implement the tactical whiteboard UI with grid background, large virtual canvas, object rendering, selection, and manipulation.

## Features and Tasks

### F04.01 - Canvas shell and layout

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T04.01.01 | Build whiteboard page layout | P0 | F01.02 | Header, toolbar, canvas, detail panel exist |
| T04.01.02 | Render Konva Stage and Layer | P0 | T04.01.01 | Canvas is visible |
| T04.01.03 | Add grid background | P0 | T04.01.02 | Grid renders behind objects |
| T04.01.04 | Implement large virtual canvas coordinate model | P0 | T04.01.02 | Objects can exist outside initial viewport |

### F04.02 - Object rendering

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T04.02.01 | Define WhiteboardObject frontend type | P0 | F01.01 | Shared object type exists |
| T04.02.02 | Render rectangle object | P0 | T04.02.01 | Rectangle appears from state |
| T04.02.03 | Render circle/ellipse object | P0 | T04.02.01 | Circle/ellipse appears from state |
| T04.02.04 | Render arrow line object | P0 | T04.02.01 | Arrow line appears from state |
| T04.02.05 | Render text object | P0 | T04.02.01 | Text appears from state |

### F04.03 - Drawing tools

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T04.03.01 | Implement toolbar tool selection | P0 | F04.01 | User can choose select/rect/circle/line/text/hand |
| T04.03.02 | Click to create rectangle with default size | P0 | T04.03.01 | Rectangle is created locally |
| T04.03.03 | Click to create circle/ellipse with default size | P0 | T04.03.01 | Circle is created locally |
| T04.03.04 | Drag to create arrow line | P0 | T04.03.01 | Arrow line is created locally |
| T04.03.05 | Click to create default text | P0 | T04.03.01 | Text is created locally |

### F04.04 - Selection and transformation

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T04.04.01 | Implement object selection | P0 | F04.02 | Click selects object |
| T04.04.02 | Show Konva Transformer for selected object | P0 | T04.04.01 | Handles appear on selected object |
| T04.04.03 | Move object by drag | P0 | T04.04.01 | Object position changes locally |
| T04.04.04 | Resize selected object | P0 | T04.04.02 | Width/height changes locally |
| T04.04.05 | Rotate selected object | P0 | T04.04.02 | Rotation changes locally |
| T04.04.06 | Delete object by button and keyboard | P0 | T04.04.01 | Selected object can be removed |

### F04.05 - Zoom and pan

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T04.05.01 | Implement mouse wheel zoom | P0 | F04.01 | User can zoom in/out |
| T04.05.02 | Implement zoom buttons | P0 | T04.05.01 | + and - buttons work |
| T04.05.03 | Implement hand tool panning | P0 | F04.01 | User can pan canvas |
| T04.05.04 | Implement Space + drag panning | P0 | T04.05.03 | Shortcut works |

### F04.06 - Object detail panel

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T04.06.01 | Display selected object details | P0 | T04.04.01 | Panel shows id/type/position/size/rotation |
| T04.06.02 | Edit text content from panel | P0 | T04.06.01 | Text object updates |
| T04.06.03 | Edit color/stroke/style from panel | P0 | T04.06.01 | Style changes apply to object |
| T04.06.04 | Edit size/position from panel | P1 | T04.06.01 | Numeric edits update object |

---

# E05. Persistence and Operation Log

## Goal

Persist whiteboard state in PostgreSQL and record operation history for reload, reconnect, audit, and future version history.

## Features and Tasks

### F05.01 - Whiteboard object persistence

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T05.01.01 | Create WhiteboardObject Prisma model | P0 | F01.04 | Object table exists |
| T05.01.02 | Implement `GET /rooms/:roomId/objects` | P0 | T05.01.01 | Client can load active objects |
| T05.01.03 | Save created object to DB | P0 | T05.01.01 | Created object persists |
| T05.01.04 | Save updated object to DB | P0 | T05.01.01 | Updated object persists |
| T05.01.05 | Soft delete object | P0 | T05.01.01 | Deleted object has `deletedAt` |

### F05.02 - Operation log

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T05.02.01 | Create WhiteboardOperation Prisma model | P0 | F01.04 | Operation table exists |
| T05.02.02 | Store OBJECT_CREATE operation | P0 | T05.02.01 | Create operation is recorded |
| T05.02.03 | Store OBJECT_UPDATE operation | P0 | T05.02.01 | Update operation is recorded |
| T05.02.04 | Store OBJECT_DELETE operation | P0 | T05.02.01 | Delete operation is recorded |
| T05.02.05 | Store inverse payload for undo candidates | P1 | T05.02.01 | Inverse data exists when possible |

### F05.03 - Room revision management

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T05.03.01 | Add `currentRevision` to Room | P0 | T03.01 | Room revision exists |
| T05.03.02 | Increment room revision in same transaction as operation | P0 | T05.02 | Operation and revision stay consistent |
| T05.03.03 | Return new revision in operation response | P0 | T05.03.02 | Client can update local revision |

### F05.04 - Snapshot schema

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T05.04.01 | Create RoomSnapshot Prisma model | P2 | F05.03 | Snapshot table exists |
| T05.04.02 | Implement manual snapshot creation service | P2 | T05.04.01 | Current state can be stored as JSON snapshot |

---

# E06. Realtime Synchronization

## Goal

Synchronize whiteboard operations among multiple users in the same room using Socket.IO.

## Features and Tasks

### F06.01 - Socket connection and room join

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T06.01.01 | Add Socket.IO Gateway to NestJS | P0 | F01.03 | Server accepts socket connections |
| T06.01.02 | Add Socket.IO client to frontend | P0 | F01.02 | Client connects to server |
| T06.01.03 | Implement `room:join` event | P0 | F03.02 | User joins socket room |
| T06.01.04 | Return room snapshot on join | P0 | F05.01 | Client receives objects and revision |
| T06.01.05 | Implement `room:leave` event | P0 | T06.01.03 | User can leave room cleanly |

### F06.02 - Object operation sync

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T06.02.01 | Implement `object:create` event | P0 | F05.01 | Create operation syncs to room |
| T06.02.02 | Implement `object:update` event | P0 | F05.01 | Update operation syncs to room |
| T06.02.03 | Implement `object:delete` event | P0 | F05.01 | Delete operation syncs to room |
| T06.02.04 | Broadcast `operation:applied` | P0 | T06.02.01 | Other clients receive accepted operation |
| T06.02.05 | Handle `operation:rejected` | P0 | T06.02.02 | Client shows error/toast |

### F06.03 - Client operation application

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T06.03.01 | Implement `applyOperation` in frontend store | P0 | F04.02 | Client can apply create/update/delete |
| T06.03.02 | Prevent duplicate operation using `clientOpId` | P0 | T06.03.01 | Same operation is not applied twice |
| T06.03.03 | Update local room revision from server event | P0 | T06.03.01 | Client revision stays current |

### F06.04 - Realtime transform preview

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T06.04.01 | Implement `object:transform-preview` event | P1 | F06.02 | Other clients can see transient movement |
| T06.04.02 | Throttle preview events | P1 | T06.04.01 | Preview does not flood server |
| T06.04.03 | Ensure preview is not persisted | P1 | T06.04.01 | DB is updated only on final operation |

---

# E07. Presence and Cursor

## Goal

Show online users and their cursor positions in the room.

## Features and Tasks

### F07.01 - Online users

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T07.01.01 | Track socket users by room | P0 | F06.01 | Server knows online users |
| T07.01.02 | Broadcast `presence:update` on join/leave | P0 | T07.01.01 | Clients see online user list |
| T07.01.03 | Display online users panel | P0 | T07.01.02 | UI shows names/colors/roles |
| T07.01.04 | Mark user offline on socket disconnect | P0 | T07.01.01 | Offline user disappears or is marked offline |

### F07.02 - Cursor realtime

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T07.02.01 | Emit `cursor:update` from frontend | P0 | F06.01 | Cursor position is sent |
| T07.02.02 | Throttle cursor update 30-50ms | P0 | T07.02.01 | Cursor events are rate-limited |
| T07.02.03 | Broadcast cursor to room except sender | P0 | T07.02.01 | Other users receive cursor |
| T07.02.04 | Render remote cursors on canvas | P0 | T07.02.03 | Cursor label appears with user name/color |

### F07.03 - Selected object presence

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T07.03.01 | Broadcast selected object id | P1 | F07.01 | Server receives current selected object |
| T07.03.02 | Show user currently selecting/editing object | P1 | T07.03.01 | Object shows editing indicator |

---

# E08. Conflict Handling and Concurrency

## Goal

Prevent inconsistent state when multiple users edit the same room or object concurrently.

## Features and Tasks

### F08.01 - Object versioning

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T08.01.01 | Add `version` field to WhiteboardObject | P0 | F05.01 | Every object has version |
| T08.01.02 | Require `baseObjectVersion` in update/delete events | P0 | F06.02 | Client sends base version |
| T08.01.03 | Increment object version after accepted update | P0 | T08.01.01 | Updated object version increases |

### F08.02 - Conflict detection and rejection

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T08.02.01 | Detect stale object update | P0 | F08.01 | Server identifies old version |
| T08.02.02 | Reject update to deleted object | P0 | F05.01 | Server returns OBJECT_ALREADY_DELETED |
| T08.02.03 | Return latest object on conflict | P0 | T08.02.01 | Client can refresh object state |
| T08.02.04 | Show conflict toast on frontend | P0 | T08.02.03 | User receives clear feedback |

### F08.03 - Server transaction boundary

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T08.03.01 | Wrap object update in DB transaction | P0 | F05.03 | Object update, room revision, operation log are atomic |
| T08.03.02 | Wrap object delete in DB transaction | P0 | F05.03 | Delete and operation log are atomic |
| T08.03.03 | Add unique constraint for `(roomId, clientOpId)` | P0 | F05.02 | Duplicate client operations are ignored/rejected |

### F08.04 - Soft lock editing indicator

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T08.04.01 | Implement `editing:start` | P1 | F07.03 | User can announce editing state |
| T08.04.02 | Implement `editing:end` | P1 | T08.04.01 | Editing state clears |
| T08.04.03 | Show warning when another user is editing selected object | P1 | T08.04.01 | Conflict risk is visible |

---

# E09. Undo/Redo and History

## Goal

Support per-user undo/redo and basic operation history display.

## Features and Tasks

### F09.01 - Per-user undo/redo stack

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T09.01.01 | Maintain undo stack in frontend memory | P1 | F06.03 | User actions are pushed to undo stack |
| T09.01.02 | Maintain redo stack in frontend memory | P1 | T09.01.01 | Redo is possible after undo |
| T09.01.03 | Clear redo stack after new action | P1 | T09.01.02 | Redo behaves correctly |

### F09.02 - Undo/redo operations

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T09.02.01 | Generate inverse operation for create | P1 | F05.02 | Create can be undone by delete |
| T09.02.02 | Generate inverse operation for update | P1 | F05.02 | Update can be undone by previous patch |
| T09.02.03 | Generate inverse operation for delete | P1 | F05.02 | Delete can be undone by restore if object still valid |
| T09.02.04 | Submit undo as new operation | P1 | F06.02 | Undo broadcasts to other users |
| T09.02.05 | Reject undo when target object is stale/deleted | P1 | F08.02 | Invalid undo is handled safely |

### F09.03 - Operation history UI

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T09.03.01 | Implement `GET /rooms/:roomId/operations?limit=50` | P1 | F05.02 | API returns latest operations |
| T09.03.02 | Build operation history panel | P1 | T09.03.01 | UI lists latest 50 operations |
| T09.03.03 | Display revision/type/object/actor/time/summary | P1 | T09.03.02 | History is understandable |

---

# E10. Reconnect Synchronization and Recovery

## Goal

Recover room state after browser refresh, socket reconnect, or temporary network interruption.

## Features and Tasks

### F10.01 - Initial room state loading

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T10.01.01 | Load room objects on page open | P0 | F05.01 | Refresh restores canvas objects |
| T10.01.02 | Load current room revision | P0 | F05.03 | Client knows latest revision |
| T10.01.03 | Reset selected object on reload | P0 | F04.04 | UI does not reference stale selection |

### F10.02 - Sync request by revision

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T10.02.01 | Store `lastSeenRevision` on client | P0 | F06.03 | Client knows last applied revision |
| T10.02.02 | Implement `sync:request` event | P0 | T10.02.01 | Client can request missed operations |
| T10.02.03 | Return operations after lastSeenRevision | P0 | F05.02 | Server returns missing operations |
| T10.02.04 | Apply returned operations in order | P0 | T10.02.03 | Client catches up correctly |

### F10.03 - Fallback full state sync

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T10.03.01 | Detect when operation replay is unavailable | P0 | F10.02 | Server can choose fallback mode |
| T10.03.02 | Return full current state as sync response | P0 | T10.03.01 | Client can recover without replay |
| T10.03.03 | Replace local state with full snapshot | P0 | T10.03.02 | Client state becomes correct |

---

# E11. Testing, Demo, and Quality Assurance

## Goal

Ensure the system works reliably for the required demo scenarios.

## Features and Tasks

### F11.01 - Manual test checklist

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T11.01.01 | Create manual test checklist | P0 | All P0 features | Checklist exists in repo |
| T11.01.02 | Test room create/join flow | P0 | E03 | Flow passes |
| T11.01.03 | Test object manipulation flow | P0 | E04/E05 | Flow passes |
| T11.01.04 | Test realtime multi-user flow | P0 | E06/E07 | Flow passes with 3 users |
| T11.01.05 | Test reconnect/reload flow | P0 | E10 | State recovers correctly |
| T11.01.06 | Test viewer cannot edit | P0 | E03/E08 | Permission is enforced |

### F11.02 - Demo scenario preparation

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T11.02.01 | Create seed sample room | P0 | F05.01 | Demo room has sample objects |
| T11.02.02 | Prepare 3-user demo script | P0 | All P0 features | Script covers owner/editor/viewer |
| T11.02.03 | Rehearse demo at least 3 times | P0 | T11.02.02 | No blocking bug remains |
| T11.02.04 | Prepare fallback screenshots/video | P1 | T11.02.03 | Backup demo material exists |

### F11.03 - Basic automated tests

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T11.03.01 | Unit test permission service | P0 | F03.02 | Role rules are tested |
| T11.03.02 | Unit test operation validation | P0 | F06.02 | Invalid operation is rejected |
| T11.03.03 | Unit test conflict detection | P0 | F08.02 | Stale version is handled |

---

# E12. Deployment, Documentation, and Final Deliverables

## Goal

Package the project for local execution and prepare final submission materials.

## Features and Tasks

### F12.01 - Docker Compose local deployment

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T12.01.01 | Add Dockerfile for backend | P0 | E01 | API image builds |
| T12.01.02 | Add Dockerfile for frontend | P0 | E01 | Web image builds |
| T12.01.03 | Add Docker Compose for web/api/postgres | P0 | T12.01.01/T12.01.02 | System starts locally |
| T12.01.04 | Add migration command to setup guide | P0 | F01.04 | DB can be initialized |

### F12.02 - README

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T12.02.01 | Write README project overview | P0 | E01 | README introduces project |
| T12.02.02 | Write setup instructions | P0 | T12.01 | New user can run app |
| T12.02.03 | Write environment variable documentation | P0 | E01 | Required env vars are clear |
| T12.02.04 | Write demo flow instructions | P0 | T11.02 | Demo can be reproduced |

### F12.03 - Technical report and slides

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T12.03.01 | Draft technical report outline | P0 | Existing design docs | Outline exists |
| T12.03.02 | Fill architecture and synchronization sections | P0 | E05/E06/E10 | Report explains core design |
| T12.03.03 | Add database and concurrency sections | P0 | E05/E08 | Report explains data/concurrency |
| T12.03.04 | Add results, limitations, future work | P0 | Final implementation | Report is submission-ready |
| T12.03.05 | Create presentation slides | P0 | T12.03.01 | Slide deck <= 20 slides |

### F12.04 - VPS deployment

| ID | Task | Priority | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|
| T12.04.01 | Prepare VPS Docker Compose deployment | P2 | T12.01 | App can run on VPS |
| T12.04.02 | Configure Nginx reverse proxy | P2 | T12.04.01 | Domain routes to app |
| T12.04.03 | Configure HTTPS | P2 | T12.04.02 | Site uses TLS |

---

# Explicitly Out of Scope Tasks

The following are not part of the 5-week delivery scope:

| ID | Item | Reason |
|---|---|---|
| X01 | Full CRDT/Yjs implementation | Too complex for timeline |
| X02 | Real map tile integration | Not required by core problem |
| X03 | Mobile app | Canvas mobile UX is large scope |
| X04 | Rich text editor | Not necessary for tactical annotations |
| X05 | Freehand drawing | Adds object complexity |
| X06 | Multi-layer advanced editor | Not needed for MVP |
| X07 | Voice/video/chat realtime | Outside main problem |
| X08 | File upload/image object | Requires storage and media handling |
| X09 | Production-scale deployment | Local Docker demo is sufficient |
| X10 | Complex audit/security compliance | Not required for mini project |
