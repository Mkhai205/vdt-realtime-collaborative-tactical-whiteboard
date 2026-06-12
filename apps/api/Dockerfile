# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm" \
    COREPACK_HOME="/tmp/corepack" \
    HOME="/tmp" \
    PATH="/pnpm:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-contracts/package.json packages/shared-contracts/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ENV DATABASE_URL="postgresql://whiteboard:whiteboard@postgres:5432/tactical_whiteboard_db?schema=public"

COPY . .

RUN pnpm exec turbo run build --filter=@rctw/api --ui=stream

FROM base AS runner

ENV NODE_ENV="production" \
    PORT="3001"

WORKDIR /app

COPY --from=build /app ./

EXPOSE 3001

CMD ["pnpm", "--filter", "@rctw/api", "start:prod"]
