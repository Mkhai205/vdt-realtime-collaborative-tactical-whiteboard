# Local Docker Compose Setup

This guide covers the F12.01 local deployment stack. It starts PostgreSQL,
applies Prisma migrations automatically, and runs the API and web app in Docker.

## Requirements

- Docker Desktop or another Docker Compose compatible runtime.
- Ports `3000`, `3001`, and `5432` available on the host, unless overridden.

## Start The Stack

From the repository root:

```powershell
docker compose up --build
```

For detached mode:

```powershell
docker compose up --build -d
docker compose ps
```

Expected local URLs:

| Service | URL |
| --- | --- |
| Web app | `http://localhost:3000` |
| API health | `http://localhost:3001/api/v1/health` |
| PostgreSQL | `localhost:5432` |

## Database Migrations

Migrations run automatically through the one-shot `migrate` service during
`docker compose up --build`. To inspect migration output:

```powershell
docker compose logs migrate
```

Manual troubleshooting equivalent:

```powershell
docker compose run --rm migrate
docker compose exec api pnpm --filter @rctw/database db:migrate:status
```

## Environment Defaults

The Compose stack has safe local defaults, so no env file is required for the
guest-mode demo.

| Variable | Default |
| --- | --- |
| `POSTGRES_USER` | `whiteboard` |
| `POSTGRES_PASSWORD` | `whiteboard` |
| `POSTGRES_DB` | `tactical_whiteboard_db` |
| `POSTGRES_DB_PORT` | `5432` |
| `API_PORT` | `3001` |
| `WEB_PORT` | `3000` |
| `DATABASE_URL` | `postgresql://whiteboard:whiteboard@postgres:5432/tactical_whiteboard_db?schema=public` |
| `CORS_ORIGIN` | `http://localhost:3000` |
| `JWT_ACCESS_SECRET` | `local-dev-jwt-secret-change-me` |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` |

Use `postgres` as the database host inside containers. Browser-facing URLs stay
on `localhost` because they are used from the host browser.

If you override the PostgreSQL user, password, or database name, also override
`DATABASE_URL` with matching values.

Google OAuth is optional for local Docker. Guest identity works without Google
credentials. To test OAuth, provide `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
and `GOOGLE_CALLBACK_URL` before starting the stack.

## Stop Or Reset

Stop containers while keeping the database volume:

```powershell
docker compose down
```

Destructive reset that removes the local database volume:

```powershell
docker compose down --volumes
```

For clean smoke tests without touching the default Compose volume, use a
temporary project name:

```powershell
docker compose -p rctw-smoke up --build -d
docker compose -p rctw-smoke ps
docker compose -p rctw-smoke down --volumes
```

## Verification

```powershell
docker compose build
docker compose up --build -d
docker compose ps
docker compose logs migrate
Invoke-WebRequest http://localhost:3001/api/v1/health
Invoke-WebRequest http://localhost:3000
docker compose down
```
