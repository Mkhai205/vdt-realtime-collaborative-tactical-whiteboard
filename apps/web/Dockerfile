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

ARG NEXT_PUBLIC_API_BASE_URL="http://localhost:3001/api/v1"
ARG NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

ENV NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
    NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL}"

COPY . .

RUN pnpm exec turbo run build --filter=@rctw/web --ui=stream

FROM base AS runner

ARG NEXT_PUBLIC_API_BASE_URL="http://localhost:3001/api/v1"
ARG NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

ENV NODE_ENV="production" \
    PORT="3000" \
    NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
    NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL}"

WORKDIR /app

COPY --from=build /app ./

EXPOSE 3000

CMD ["pnpm", "--filter", "@rctw/web", "exec", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
