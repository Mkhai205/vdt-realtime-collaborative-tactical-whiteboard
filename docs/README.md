Reference [reference.md](./reference.md) for detailed API documentation and implementation notes.

# Realtime Collaborative Tactical Whiteboard

This repository contains the **Realtime Collaborative Tactical Whiteboard** project developed for the **Viettel Digital Talent 2026 - Software Engineer Track**. It is a monorepo containing a web-based collaborative whiteboard that allows multiple users to join the same room and manipulate objects on a virtual canvas in realtime with presence awareness, conflict-aware editing, and server-authoritative persistence.

---

## 1. Project Overview & Product Goals

### 1.1 Core Values

1. **Realtime Multi-User Editing**: Shape changes made by one user are immediately visible to all other users in the room.
2. **Presence & Cursor Awareness**: Users can see who is online and track where others are pointing on the canvas in realtime.
3. **Persistence & Reconnect Recovery**: Canvas data is stored on the server, permitting full restoration of state upon reload or after disconnection.
4. **Conflict-Aware Collaboration**: The system detects stale updates using object-level versions and resolves concurrent edits via room-level revision ordering.

### 1.2 Scope & Priority (MVP vs. Non-Goals)

- **Must-Have (MVP)**: Guest sign-in (by name), public room creation and sharing via link, role enforcement (Owner, Editor, Viewer), canvas interactions (pan, zoom, create/move/resize/rotate/delete rectangles, circles, arrow lines, and text), realtime sync, remote cursors, and DB persistence.
- **Should-Have**: Google OAuth login (JWT), private rooms, owner-only room deletion, role management UI, and object-locking indicators.
- **Won't-Have**: Infinite canvas, real map integration, mobile-first design, freehand drawing, layer system, grouping, multi-select, voice/chat, or media/image upload.

---

## 2. Monorepo Architecture & Tech Stack

### 2.1 Workspace Structure

The project is structured as a Turborepo monorepo:

- **`apps/web`**: Next.js client application (React, Tailwind CSS, React-Konva, Zustand, Socket.IO Client).
- **`apps/api`**: NestJS backend application (REST APIs, Socket.IO Gateway, Prisma Client).
- **`packages/database`**: PostgreSQL database definition, Prisma schema, and migrations.
- **`packages/shared-contracts`**: Shared TypeScript types and Zod schema validations used by both frontend and backend.

### 2.2 System Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients
        UA[User A Web App]
        UB[User B Web App]
    end

    subgraph Backend
        Web[Next.js Gateway Router]
        API[NestJS REST Service]
        WS[NestJS WebSocket Gateway]
    end

    subgraph Database Layer
        DB[(PostgreSQL)]
    end

    UA & UB -->|HTTP/REST| API
    UA <-->|WebSocket Socket.IO| WS
    API -->|Prisma| DB
    WS -->|Prisma| DB
```

---

## 3. Database Design

The database uses **PostgreSQL** with **Prisma ORM**. The schema distinguishes between the **current state** (`WhiteboardObject`) and **historical changes** (`WhiteboardOperation`) to support operations log, conflict resolution, and reconnect sync.

### 3.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Board : "creates"
    User ||--o{ BoardMember : "joins"
    User ||--o{ WhiteboardOperation : "performs"
    Board ||--o{ BoardMember : "has"
    Board ||--o{ WhiteboardObject : "contains"
    Board ||--o{ WhiteboardOperation : "records"
    Board ||--o{ BoardSnapshot : "has"
    WhiteboardObject ||--o{ WhiteboardOperation : "targets"
```

### 3.2 Prisma Schema Models

- **`User`**: Manages guest identities (`GUEST`) and Google OAuth accounts (`GOOGLE`), avatar styles, and names.
- **`Board`**: Represents the collaboration room containing metadata, the current room revision, and deletion state.
- **`BoardMember`**: Maps users to boards with roles (`OWNER`, `EDITOR`, `VIEWER`).
- **`WhiteboardObject`**: Stores current canvas objects (type: `RECTANGLE`, `CIRCLE`, `LINE`, `TEXT`), coordinate data (`x`, `y`, `width`, `height`), style properties, `zIndex`, and current `version` for conflict checks.
- **`WhiteboardOperation`**: Records sequential historical events (`OBJECT_CREATE`, `OBJECT_UPDATE`, `OBJECT_DELETE`, `OBJECT_RESTORE`) linked to specific room revisions.
- **`BoardSnapshot`**: Optional snapshots storing serialized state at fixed revisions for recovery optimization.

---

## 4. Realtime Synchronization & Concurrency Model

### 4.1 Server-Authoritative Sync Flow

Clients apply edits locally in an optimistic or preview state, but must send operations to the server for validation and final commit.

1. **Emit Operation**: The client emits a socket operation containing the changes and the target object's `baseObjectVersion`.
2. **Validate & Commit**: The server runs permission checks, verifies if `baseObjectVersion` matches the database's current object `version` (conflict check), executes a database transaction to update the object and append the operation log, increments the room's `currentRevision`, and assigns this revision to the operation.
3. **Broadcast & Apply**: The server responds back with `operation:applied` to the initiator and broadcasts it to all other room members, who then apply the mutation locally.

### 4.2 Concurrency Conflict Resolution

- **Version Check**: When a user attempts to update an object, the server checks if `client.baseObjectVersion === server.currentObjectVersion`.
- **Match**: The update is applied, object version is incremented (`version + 1`), and the room revision increments.
- **Mismatch**: The update is rejected. The server emits an error event (e.g. `operation:rejected`), and the client must rollback the optimistic edit and pull the latest state.

### 4.3 Reconnect Synchronization

When a disconnected client reconnects, it sends `sync:request` containing its last known room revision:

- If the client is only a few revisions behind, the server sends all `WhiteboardOperation` events recorded since that revision.
- If the client is too far behind or does not specify a revision, the server sends the full board state (`WhiteboardObject[]`).
