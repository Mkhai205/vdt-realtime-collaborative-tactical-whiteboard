# 11. Coding Agent Execution Plan

**Project:** Realtime Collaborative Tactical Whiteboard\
**Document version:** v0.1\
**Status:** Draft

---

## 1. Purpose

This document defines how to use a coding agent safely and effectively for implementation. The agent should implement small, well-scoped tasks based on existing design documents.

---

## 2. General Rules for Coding Agent

The coding agent must follow these rules:

```txt
Do:
- Follow the documented architecture.
- Implement one task or one small feature at a time.
- Use TypeScript strict mode.
- Use shared schemas/types where available.
- Keep REST payloads compatible with `12_REST_API_CONTRACT.md`.
- Keep WebSocket payloads compatible with `07_WEBSOCKET_EVENT_CONTRACT.md`.
- Validate all backend inputs.
- Enforce permissions on the server side.
- Use database transactions for object operations.
- Return clear error codes.
- Explain changed files after implementation.

Don't:
- Do not introduce new libraries without approval.
- Do not change architecture without approval.
- Do not rewrite unrelated modules.
- Do not store the entire canvas as one big JSON only.
- Do not broadcast events to all rooms.
- Do not trust client-side role checks.
- Do not skip persistence for persistent operations.
- Do not mix transient preview events with operation log events.
```

---

## 3. Task Prompt Template

Use this prompt template when asking the coding agent to implement a task:

```txt
You are working on the Realtime Collaborative Tactical Whiteboard project.

Task ID:
[Task ID]

Task title:
[Task title]

Context:
[Explain current project state and relevant design decisions]

Related documents:
- [Document name and section]

Relevant files:
- [Known files, if any]

Requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Constraints:
- Do not change unrelated files.
- Do not introduce new libraries.
- Keep TypeScript strict.
- Follow existing folder structure.
- Add validation and error handling where relevant.

Acceptance criteria:
- [Criterion 1]
- [Criterion 2]
- [Criterion 3]

Manual test steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected output:
- List of changed files
- Summary of implementation
- Manual test instructions
- Any known limitations
```

---

## 4. Recommended Task Size

Good coding-agent task size:

```txt
- One API endpoint
- One WebSocket event
- One frontend component
- One store action
- One Prisma model + migration
- One small integration flow
```

Bad coding-agent task size:

```txt
- Build the whole realtime system
- Implement all canvas features
- Create complete backend and frontend
- Fix all bugs
- Make the app production-ready
```

---

## 5. Implementation Order for Coding Agent

### Phase 1 - Foundation

```txt
1. Monorepo setup
2. Next.js app setup
3. NestJS app setup
4. Prisma/PostgreSQL setup
5. Shared types/schemas setup
```

### Phase 2 - Canvas MVP

```txt
1. Whiteboard layout
2. Konva Stage and grid
3. Object type definitions
4. Shape rendering
5. Drawing tools
6. Selection and transformer
7. Detail panel
```

### Phase 3 - Persistence

```txt
1. Room model/API
2. RoomMember model/API
3. WhiteboardObject model/API
4. WhiteboardOperation model
5. Room revision logic
6. Load objects after refresh
```

### Phase 4 - Realtime

```txt
1. Socket.IO gateway
2. Socket client hook/service
3. room:join event
4. object:create event
5. object:update event
6. object:delete event
7. operation:applied handling
8. presence and cursor
```

### Phase 5 - Recovery and Concurrency

```txt
1. Object versioning
2. Conflict detection
3. Transaction boundary
4. sync:request event
5. operation replay
6. full state fallback
7. role enforcement
```

### Phase 6 - Advanced and Deliverables

```txt
1. Undo/redo baseline
2. Operation history UI
3. Soft lock indicator
4. Docker Compose
5. README
6. Demo script
```

---

## 6. Example Coding Agent Prompts

### Example 1 - Prisma Room Model

```txt
You are working on the Realtime Collaborative Tactical Whiteboard project.

Task ID:
T03.01.01

Task title:
Create Room Prisma model

Context:
The project uses NestJS, Prisma, PostgreSQL, and Turborepo. Room is the main collaborative workspace. Each room stores metadata and currentRevision for synchronization.

Related documents:
- 06_DATABASE_DESIGN.md
- 09_EPIC_FEATURE_TASK_BREAKDOWN.md

Requirements:
- Add Room model to Prisma schema.
- Fields: id, name, description, createdById, currentRevision, isPublic, defaultJoinRole, createdAt, updatedAt, deletedAt.
- Use UUID primary key.
- currentRevision defaults to 0.
- isPublic defaults to true.
- defaultJoinRole defaults to EDITOR.

Constraints:
- Do not add unrelated models in this task.
- Do not change existing configuration.

Acceptance criteria:
- Prisma schema is valid.
- Migration can be generated.
- Room model matches database design.

Manual test steps:
1. Run Prisma format.
2. Generate migration.
3. Apply migration.
```

---

### Example 2 - WebSocket Object Update

```txt
You are working on the Realtime Collaborative Tactical Whiteboard project.

Task ID:
T06.02.02

Task title:
Implement object:update WebSocket event

Context:
The system uses server-authoritative realtime synchronization. Client sends object update operation. Server validates permission and version, persists the update, writes operation log, increments room revision, and broadcasts operation:applied to room members.

Related documents:
- 05_REALTIME_SYNCHRONIZATION_DESIGN.md
- 07_WEBSOCKET_EVENT_CONTRACT.md
- 09_EPIC_FEATURE_TASK_BREAKDOWN.md

Requirements:
- Add handler for object:update.
- Validate payload with shared schema.
- Check user is room member.
- Check role is OWNER or EDITOR.
- Check object exists and is not deleted.
- Check baseObjectVersion.
- Apply patch in database transaction.
- Increment object version.
- Increment room currentRevision.
- Insert WhiteboardOperation.
- Broadcast operation:applied to room.
- Return operation:rejected on error.

Constraints:
- Do not persist transform-preview events here.
- Do not broadcast to users outside the room.
- Do not trust client-side role.

Acceptance criteria:
- Editor can update object.
- Viewer cannot update object.
- Other room members receive operation:applied.
- Stale baseObjectVersion returns conflict error.
```

---

### Example 3 - Frontend Remote Cursor

```txt
You are working on the Realtime Collaborative Tactical Whiteboard project.

Task ID:
T07.02.04

Task title:
Render remote cursors on canvas

Context:
Each user sends cursor:update events throttled to 30-50ms. Other room members should see remote cursor indicators with user name and avatar color.

Related documents:
- 05_REALTIME_SYNCHRONIZATION_DESIGN.md
- 07_WEBSOCKET_EVENT_CONTRACT.md

Requirements:
- Add remote cursor rendering layer in canvas.
- Render cursor pointer and user label.
- Use avatarColor for cursor color.
- Do not render current user's own cursor.
- Remove cursor when user disconnects or leaves room.

Constraints:
- Do not persist cursor position.
- Do not create database writes.
- Keep cursor rendering separate from object rendering.

Acceptance criteria:
- User A sees User B's cursor.
- User B sees User A's cursor.
- Cursor label shows display name.
- Cursor disappears when user leaves.
```

---

## 7. Review Checklist for Coding Agent Output

After every coding-agent output, check:

```txt
[ ] Did it modify only relevant files?
[ ] Did it follow existing folder structure?
[ ] Did it introduce unapproved dependencies?
[ ] Did it keep TypeScript types strict?
[ ] Did it validate inputs?
[ ] Did it enforce server-side permission?
[ ] Did it use transaction where needed?
[ ] Did it broadcast only to the correct room?
[ ] Did it update documentation if required?
[ ] Did it provide manual test steps?
```

---

## 8. Bug Fix Prompt Template

```txt
Bug:
[Describe the bug]

Observed behavior:
[What happened]

Expected behavior:
[What should happen]

Steps to reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Relevant logs/error:
[Paste error]

Constraints:
- Fix the root cause, not only the symptom.
- Do not rewrite unrelated code.
- Explain why the bug happened.
- Provide manual verification steps.
```

---

## 9. Refactor Prompt Template

```txt
Refactor target:
[File/module/component]

Goal:
[Why refactor is needed]

Constraints:
- Do not change behavior.
- Do not change public API/event contract.
- Keep tests/manual behavior passing.
- Explain changed structure.

Acceptance criteria:
- Behavior remains the same.
- Code is simpler or better separated.
- No unrelated changes.
```

---

## 10. Final Instruction

Use the coding agent as an implementation assistant, not as the system architect. Architecture, contracts, and scope decisions must remain controlled by the project documents.
