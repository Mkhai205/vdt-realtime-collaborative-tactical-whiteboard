# RCTW API

NestJS backend for the Realtime Collaborative Tactical Whiteboard. The API owns
identity resolution, room management, persistent whiteboard objects, operation
history, snapshots, and Socket.IO realtime synchronization.

## Runtime Shape

- REST base path: `http://localhost:3001/api/v1`
- Health check: `GET /api/v1/health`
- WebSocket transport: Socket.IO on the API server origin
- REST contract source: `../../docs/12_REST_API_CONTRACT.md`
- WebSocket contract source: `../../docs/07_WEBSOCKET_EVENT_CONTRACT.md`
- Shared schemas: `@rctw/shared-contracts`

Persistent shared state is server-authoritative. Clients may be optimistic
locally, but accepted room mutations are finalized through `operation:applied`.
Initial socket readiness is the `room:state` event, not transport connection.

## Environment

Copy `.env.example` to `.env` for local development.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, defaults to `3001`. |
| `CORS_ORIGIN` | Comma-separated frontend origins allowed for REST and Socket.IO. |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `JWT_ACCESS_SECRET` | Secret for Bearer JWT verification/signing. |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | Access-token lifetime. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `GOOGLE_CALLBACK_URL` | Backend OAuth callback URL. |
| `FRONTEND_LOGIN_SUCCESS_REDIRECT` | Frontend success callback URL. |
| `FRONTEND_LOGIN_FAILURE_REDIRECT` | Frontend error callback URL. |

## Scripts

Run commands from the repo root unless noted.

```powershell
pnpm --filter @rctw/api dev
pnpm --filter @rctw/api test -- --runInBand
pnpm --filter @rctw/api lint
pnpm --filter @rctw/api typecheck
pnpm --filter @rctw/api build
```

For contract or Prisma changes, rebuild upstream packages first so API sees
fresh generated declarations:

```powershell
pnpm --filter @rctw/shared-contracts build
pnpm --filter @rctw/database db:generate
pnpm --filter @rctw/database build
```

## Verification Notes

- Focused realtime checks: `pnpm --filter @rctw/api test -- realtime --runInBand`
- Focused object checks: `pnpm --filter @rctw/api test -- whiteboard-objects.service.spec.ts --runInBand`
- Full API gate: test, lint, typecheck, then build if release packaging changed.

`pnpm --filter @rctw/api typecheck` may create
`apps/api/tsconfig.tsbuildinfo` because the package tsconfig is incremental.
Remove it before finishing unless it is intentionally tracked.

## Internal Conventions

- Controllers validate inputs with shared Zod schemas through `ZodBody`,
  `ZodQuery`, and `ZodParam`.
- Services throw Nest HTTP exceptions with shared `ApiError` bodies; the global
  `ApiExceptionFilter` normalizes REST failures.
- `WhiteboardObjectsService` is the public facade for controllers and realtime
  handlers. Keep REST and Socket.IO contracts stable when refactoring internals.
- `PresenceService` is in-memory and assumes a single API instance for the MVP.
