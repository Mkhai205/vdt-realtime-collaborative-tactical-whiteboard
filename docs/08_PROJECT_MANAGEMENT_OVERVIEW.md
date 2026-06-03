# 08. Project Management Overview

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 - Software Engineer Track  
**Document version:** v0.1  
**Status:** Draft  
**Planning horizon:** 5 weeks  

---

## 1. Purpose

This document defines how the project will be managed before and during implementation. It converts the approved product scope into a delivery model that can be executed by a developer with support from a coding agent.

The project is managed using a lightweight agile approach:

- Requirements are grouped by **Epic**.
- Each Epic is divided into **Features**.
- Each Feature is broken down into small implementation **Tasks**.
- Tasks are assigned to weekly milestones.
- Every task must have acceptance criteria before being considered complete.

---

## 2. Delivery Principles

### 2.1 Build the realtime core first

The highest-risk part of this project is not the UI. The highest-risk parts are:

- WebSocket room synchronization
- server-authoritative state
- persistence and reload recovery
- reconnect synchronization
- conflict detection

Therefore, implementation must prioritize the realtime and persistence pipeline before optional UI polish.

### 2.2 Keep authentication from blocking the core system

The MVP must support **guest users joining by display name**. Google OAuth is a should-have enhancement and must not block delivery of canvas collaboration.

### 2.3 Use contracts before implementation

Before coding any module, the related schema, API contract, WebSocket event contract, and acceptance criteria must be checked.

### 2.4 Prefer working vertical slices

A feature is valuable only when it works end-to-end. For example, object creation is only complete when:

1. user creates an object on the frontend;
2. client sends the operation;
3. server validates and persists it;
4. server broadcasts the accepted operation;
5. other clients render it;
6. reload restores it from database.

---

## 3. Project Management Model

### 3.1 Epic

An Epic is a major product capability.

Example:

```txt
E04 - Canvas Object Manipulation
```

### 3.2 Feature

A Feature is a user-visible capability inside an Epic.

Example:

```txt
F04.03 - Resize and rotate selected object
```

### 3.3 Task

A Task is an implementation unit small enough to be completed and reviewed independently.

Example:

```txt
T04.03.02 - Integrate Konva Transformer for selected shape
```

---

## 4. Work Item ID Convention

```txt
E{epic_number}                Epic
F{epic_number}.{feature_no}   Feature
T{epic_number}.{feature_no}.{task_no} Task
```

Example:

```txt
E05 - Realtime Synchronization
F05.02 - Object update synchronization
T05.02.03 - Broadcast operation:applied to room members
```

---

## 5. Priority Levels

| Priority | Meaning | Rule |
|---|---|---|
| P0 | Critical MVP | Must be completed before demo |
| P1 | Important MVP / should-have | Complete after P0 is stable |
| P2 | Bonus | Implement only if time remains |
| P3 | Out of scope | Do not implement in 5-week scope |

---

## 6. Scope Categories

| Category | Meaning |
|---|---|
| Must-have | Required for the main demo and report |
| Should-have | Strongly recommended technical enhancement |
| Could-have | Bonus if core features are stable |
| Won't-have | Explicitly excluded from the 5-week scope |

---

## 7. Weekly Milestone Strategy

| Week | Main Objective | Expected Outcome |
|---|---|---|
| Week 1 | Foundation + local canvas | Project scaffold, room basics, local object rendering |
| Week 2 | Persistence + manipulation | Object create/move/resize/rotate/delete persisted in DB |
| Week 3 | Realtime collaboration | Multi-user room sync, cursor, online users |
| Week 4 | Recovery + concurrency + roles | reconnect sync, role enforcement, conflict detection, undo/redo baseline |
| Week 5 | Stabilization + deliverables | testing, polish, Docker, README, report, slides, demo rehearsal |

---

## 8. Task Board Columns

The recommended board columns are:

```txt
Backlog -> Ready -> In Progress -> Review -> Testing -> Done -> Blocked
```

### Backlog

Task exists but is not yet ready for implementation.

### Ready

Task has enough information to start coding.

### In Progress

Task is being implemented.

### Review

Implementation is finished and awaiting code review/self-review.

### Testing

Task is being verified manually or automatically.

### Done

Task satisfies the Definition of Done.

### Blocked

Task cannot continue due to missing dependency, unclear design, or technical issue.

---

## 9. Definition of Ready

A task is ready when:

- requirement is clear;
- related contract/schema is known;
- dependencies are identified;
- expected behavior is described;
- acceptance criteria are written;
- no major architecture decision is pending.

---

## 10. Definition of Done

A task is done when:

- implementation compiles without TypeScript errors;
- feature works manually;
- validation and error handling are included;
- backend permission is enforced when relevant;
- realtime events are scoped to the correct room;
- database state remains consistent;
- related document or README section is updated if necessary.

---

## 11. Delivery Risk Policy

If the schedule becomes tight, reduce scope in this order:

1. VPS deployment
2. background image
3. export/import JSON
4. role management UI
5. operation history UI
6. soft lock indicator
7. realtime transform preview
8. Google OAuth

Do not cut the following unless absolutely unavoidable:

- create/join room;
- object create/update/delete;
- persistence;
- realtime broadcast;
- reconnect recovery;
- basic role enforcement;
- conflict detection.

---

## 12. Project Success Criteria

The project is successful if the final demo proves:

- 3 users can join the same room as owner/editor/viewer;
- owner/editor can create and manipulate objects;
- viewer cannot edit but can observe realtime changes;
- object changes sync to other users in realtime;
- cursor and online presence work;
- reload does not lose canvas data;
- reconnect restores state correctly;
- conflict detection works in at least one simple scenario;
- Docker Compose can run the system locally;
- technical report and slides explain the architecture clearly.
