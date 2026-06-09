# 12. REST API Contract

**Project:** Realtime Collaborative Tactical Whiteboard  
**Program:** Viettel Digital Talent 2026 - Software Engineer Track  
**Document status:** Draft v0.1  
**Owner role:** Backend Lead / Full-stack Lead  
**Timebox:** 5 weeks  

---

## 1. Purpose

This document defines the MVP REST API contract between the frontend and backend.

WebSocket events are defined separately in `07_WEBSOCKET_EVENT_CONTRACT.md`.

REST APIs are used for:

```txt
- guest/JWT identity resolution
- room create/list/detail/update/delete
- current object loading
- operation history loading
- member and role loading
```

All REST payloads should be validated using shared Zod schemas in `packages/shared-contracts`.

---

## 2. Common Rules

### 2.1 Transport

```txt
Content-Type: application/json
Response format: JSON
```

### 2.2 Identity

The identity foundation supports browser-local guests and Google OAuth users.
JWT identity takes precedence over guest identity.

REST requests that require a user must provide one of:

```txt
Authorization: Bearer <jwt>
```

or MVP guest headers:

```txt
x-guest-id: <uuid>
x-guest-name: <display name>
x-guest-avatar-color: <css color>
```

Rules:

```txt
- If a Bearer JWT is provided, backend resolves the authenticated user.
- If a Bearer JWT is provided but invalid, backend returns 401 UNAUTHENTICATED and does not fall back to guest headers.
- If guest headers are provided, backend creates or resolves a GUEST user.
- If neither identity source is valid, backend returns 401 UNAUTHENTICATED.
- guestId should be stable in localStorage for the browser session/demo.
- frontend stores the OAuth access token in localStorage key rctw.authToken.v1.
- frontend attaches Authorization: Bearer <jwt> to REST requests when a token exists; otherwise it attaches guest headers.
```

### 2.2.1 Google OAuth Login

OAuth is backend-driven and does not use Passport or server sessions.

```txt
GET /api/v1/auth/google
```

Behavior:

```txt
- Validates GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, and JWT_ACCESS_SECRET.
- Creates a short-lived httpOnly state cookie.
- Redirects to Google OAuth with openid email profile scopes.
- If OAuth/JWT config is missing, returns a clear configuration error.
```

```txt
GET /api/v1/auth/google/callback?code=<code>&state=<state>
```

Behavior:

```txt
- Validates state against the state cookie.
- Exchanges the Google code and verifies the Google ID token.
- Requires a verified email.
- Creates or updates a GOOGLE user by email.
- Issues a JWT access token.
- Redirects to FRONTEND_LOGIN_SUCCESS_REDIRECT#accessToken=<jwt>.
- On callback failure, redirects to FRONTEND_LOGIN_FAILURE_REDIRECT?reason=<code>.
```

JWT payload minimum:

```ts
type JwtIdentityPayload = {
  sub: string;
  email: string;
  name: string;
  identityType: "GOOGLE";
};
```

### 2.3 Revision Serialization

Database revisions are stored as `BigInt`.

REST responses expose revision values as `number` for the MVP.

The backend must convert Prisma `BigInt` values before returning JSON.

### 2.4 Error Format

```ts
type ApiError = {
  code:
    | "UNAUTHENTICATED"
    | "PERMISSION_DENIED"
    | "VALIDATION_ERROR"
    | "ROOM_NOT_FOUND"
    | "OBJECT_NOT_FOUND"
    | "OBJECT_ALREADY_DELETED"
    | "OBJECT_VERSION_CONFLICT"
    | "DUPLICATE_OPERATION"
    | "INVALID_OPERATION_PAYLOAD"
    | "MEMBER_NOT_FOUND"
    | "INTERNAL_ERROR";
  message: string;
  details?: unknown;
};
```

### 2.5 Common Status Codes

| Status | Meaning |
|---:|---|
| 200 | Request succeeded. |
| 201 | Resource created. |
| 204 | Request succeeded with no response body. |
| 400 | Invalid payload or query. |
| 401 | Missing or invalid identity. |
| 403 | User does not have permission. |
| 404 | Resource does not exist or is not accessible. |
| 500 | Unexpected server error. |

---

## 3. Common Types

```ts
type UserSummary = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
};

type RoomRole = "OWNER" | "EDITOR" | "VIEWER";

type RoomSummary = {
  id: string;
  name: string;
  description?: string | null;
  currentRevision: number;
  isPublic: boolean;
  defaultJoinRole: "EDITOR" | "VIEWER";
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
};

type RoomMemberSummary = {
  id: string;
  roomId: string;
  user: UserSummary;
  role: RoomRole;
  joinedAt: string;
};

type MemberRoleInput = "EDITOR" | "VIEWER";

type WhiteboardObject = {
  id: string;
  roomId: string;
  type: "RECTANGLE" | "CIRCLE" | "LINE" | "TEXT";
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  points?: number[] | null;
  text?: string | null;
  rotation: number;
  style: unknown;
  zIndex: number;
  version: number;
  createdById: string;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type OperationSummary = {
  id: string;
  clientOpId: string;
  roomId: string;
  actor: UserSummary;
  objectId?: string | null;
  revision: number;
  type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE" | "OBJECT_RESTORE";
  summary: string;
  createdAt: string;
};
```

---

## 4. Room APIs

## 4.1 `POST /rooms`

Create a room.

### Permission

Any resolved guest or authenticated user.

### Request Body

```ts
type CreateRoomRequest = {
  name: string;
  description?: string | null;
  isPublic?: boolean;
  defaultJoinRole?: "EDITOR" | "VIEWER";
};
```

### Response `201`

```ts
type CreateRoomResponse = {
  room: RoomSummary;
  currentUser: UserSummary & {
    role: "OWNER";
  };
};
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
```

---

## 4.2 `GET /rooms`

List rooms visible to the current user.

### Permission

Any resolved guest or authenticated user.

### Query

```ts
type ListRoomsQuery = {
  limit?: number;
};
```

### Response `200`

```ts
type ListRoomsResponse = {
  rooms: RoomSummary[];
};
```

### Rules

```txt
- Return public rooms.
- Return private rooms only when the user is a member.
- Exclude soft-deleted rooms.
- Default limit is 50.
```

---

## 4.3 `GET /rooms/:roomId`

Get room metadata and the current user's role.

### Permission

User must be able to access the room.

### Response `200`

```ts
type GetRoomResponse = {
  room: RoomSummary;
  currentUser: UserSummary & {
    role: RoomRole;
  };
};
```

### Errors

```txt
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

---

## 4.4 `POST /rooms/:roomId/join`

Join a public room by link or resolve the current user's existing membership.

### Permission

Any resolved guest or authenticated user. Private rooms require existing active membership.

### Response `201`

```ts
type JoinRoomResponse = {
  room: RoomSummary;
  currentUser: UserSummary & {
    role: RoomRole;
  };
};
```

### Rules

```txt
- Existing active members keep their current role.
- Public non-members become active members using room.defaultJoinRole.
- Removed public members are reactivated using room.defaultJoinRole.
- Private non-members are rejected.
- This is the only REST room metadata endpoint that creates membership.
```

### Errors

```txt
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

---

## 4.5 `PATCH /rooms/:roomId`

Update room metadata.

### Permission

Owner only.

### Request Body

```ts
type UpdateRoomRequest = Partial<{
  name: string;
  description: string | null;
  isPublic: boolean;
  defaultJoinRole: "EDITOR" | "VIEWER";
}>;
```

### Response `200`

```ts
type UpdateRoomResponse = {
  room: RoomSummary;
};
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

---

## 4.6 `DELETE /rooms/:roomId`

Soft delete a room.

This endpoint is should-have if time is limited.

### Permission

Owner only.

### Response `204`

No body.

### Errors

```txt
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

---

## 5. Object APIs

## 5.1 `GET /rooms/:roomId/objects`

Load active whiteboard objects for a room.

### Permission

Owner, editor, or viewer.

### Response `200`

```ts
type GetRoomObjectsResponse = {
  roomId: string;
  currentRevision: number;
  objects: WhiteboardObject[];
};
```

### Rules

```txt
- Exclude objects where deletedAt is not null.
- Order by zIndex ASC, createdAt ASC.
- This endpoint is used for reload/full-state loading.
```

### Errors

```txt
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

## 5.2 `POST /rooms/:roomId/objects`

Create a whiteboard object through the REST persistence bridge.

### Permission

Owner or editor only.

### Request Body

```ts
type ObjectCreateRequest = {
  clientOpId: string;
  baseRoomRevision?: number;
  object: {
    type: "RECTANGLE" | "CIRCLE" | "LINE" | "TEXT";
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: number[];
    text?: string;
    rotation?: number;
    style?: ShapeStyle;
    zIndex?: number;
  };
};
```

### Response `201`

```ts
type OperationAppliedEvent = {
  operationId: string;
  clientOpId: string;
  roomId: string;
  revision: number;
  type: "OBJECT_CREATE" | "OBJECT_UPDATE" | "OBJECT_DELETE" | "OBJECT_RESTORE";
  objectId?: string | null;
  actor: UserSummary;
  payload: unknown;
  resultingObject?: WhiteboardObject | null;
  createdAt: string;
};
```

### Rules

```txt
- Server creates the object id.
- Object starts at version 1.
- Room currentRevision is incremented in the same transaction.
- A WhiteboardOperation row is inserted with type OBJECT_CREATE.
- Duplicate clientOpId in the same room returns 409 DUPLICATE_OPERATION.
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
409 DUPLICATE_OPERATION
```

## 5.3 `PATCH /rooms/:roomId/objects/:objectId`

Update mutable object fields through the REST persistence bridge.

### Permission

Owner or editor only.

### Request Body

```ts
type ObjectUpdateRequest = {
  clientOpId: string;
  baseRoomRevision?: number;
  baseObjectVersion: number;
  patch: ObjectMutablePatch;
};
```

### Response `200`

Returns `OperationAppliedEvent` with `type: "OBJECT_UPDATE"` and the updated object in `resultingObject`.

### Rules

```txt
- Only mutable canvas fields are accepted in patch.
- style patches are merged with existing style.
- baseObjectVersion must match current object.version.
- Object version and room currentRevision increment in the same transaction.
- A WhiteboardOperation row is inserted with previousValues and resultingObject.
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
404 OBJECT_NOT_FOUND
409 OBJECT_ALREADY_DELETED
409 OBJECT_VERSION_CONFLICT
409 DUPLICATE_OPERATION
```

## 5.4 `DELETE /rooms/:roomId/objects/:objectId`

Soft delete a whiteboard object through the REST persistence bridge.

### Permission

Owner or editor only.

### Request Body

```ts
type ObjectDeleteRequest = {
  clientOpId: string;
  baseRoomRevision?: number;
  baseObjectVersion: number;
};
```

### Response `200`

Returns `OperationAppliedEvent` with `type: "OBJECT_DELETE"` and the soft-deleted object in `resultingObject`.

### Rules

```txt
- deletedAt is set instead of hard deleting the row.
- baseObjectVersion must match current object.version.
- Object version and room currentRevision increment in the same transaction.
- A WhiteboardOperation row is inserted with previousObject for history/undo candidates.
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
404 OBJECT_NOT_FOUND
409 OBJECT_ALREADY_DELETED
409 OBJECT_VERSION_CONFLICT
409 DUPLICATE_OPERATION
```

---

## 6. Operation APIs

## 6.1 `GET /rooms/:roomId/operations`

Load operation history for a room.

### Permission

Owner, editor, or viewer.

### Query

```ts
type GetRoomOperationsQuery = {
  limit?: number;
};
```

### Response `200`

```ts
type GetRoomOperationsResponse = {
  roomId: string;
  operations: OperationSummary[];
};
```

### Rules

```txt
- Default limit is 50.
- Maximum limit is 100.
- Order by revision DESC.
- History is read-only in the MVP.
```

### Errors

```txt
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

---

## 7. Member APIs

## 7.1 `GET /rooms/:roomId/members`

Load room members and roles.

### Permission

Owner, editor, or viewer.

### Response `200`

```ts
type GetRoomMembersResponse = {
  roomId: string;
  members: RoomMemberSummary[];
};
```

### Rules

```txt
- Exclude removed members.
- Public guest join creates or resolves a RoomMember using room.defaultJoinRole.
- Role management UI uses direct userId invite for the should-have private room flow.
```

### Errors

```txt
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
```

---

## 7.2 `POST /rooms/:roomId/members`

Add an existing user as a room member, or update/reactivate an existing non-owner member.

### Permission

Owner only.

### Request Body

```ts
type AddRoomMemberRequest = {
  userId: string;
  role: MemberRoleInput;
};
```

### Response `201`

```ts
type RoomMemberMutationResponse = {
  member: RoomMemberSummary;
};
```

### Rules

```txt
- Target user must already exist.
- Existing active non-owner member is updated to the requested role.
- Removed non-owner member is reactivated with the requested role.
- OWNER membership cannot be created or modified by this endpoint.
- This endpoint does not create invite tokens or send email.
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
404 MEMBER_NOT_FOUND
```

---

## 7.3 `PATCH /rooms/:roomId/members/:memberId`

Change an active non-owner member's role.

### Permission

Owner only.

### Request Body

```ts
type UpdateRoomMemberRoleRequest = {
  role: MemberRoleInput;
};
```

### Response `200`

```ts
type RoomMemberMutationResponse = {
  member: RoomMemberSummary;
};
```

### Rules

```txt
- Only EDITOR and VIEWER can be assigned.
- Removed members cannot be updated.
- OWNER membership cannot be modified by this endpoint.
- Owner transfer is out of scope for the MVP.
```

### Errors

```txt
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 PERMISSION_DENIED
404 ROOM_NOT_FOUND
404 MEMBER_NOT_FOUND
```

---

## 8. Final REST Contract Decision

The REST API contract uses:

```txt
- JSON request/response bodies
- shared Zod validation
- guest headers or JWT for identity
- server-side permission enforcement
- number revision serialization for MVP API responses
- read-only operation history endpoint
```
