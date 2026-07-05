# Stage 1: Build stage
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10.33.2

WORKDIR /app

# Copy workspace configuration and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for dependency caching
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-contracts/package.json ./packages/shared-contracts/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy codebase
COPY . .

# Set dummy DATABASE_URL for build-time Prisma client generation
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy

# Generate Prisma client and build packages
RUN pnpm --filter @rctw/database build
RUN pnpm --filter @rctw/shared-contracts build
RUN pnpm --filter @rctw/api build

# Prune and deploy API package to standalone directory /app/deployed
RUN pnpm --filter @rctw/api --prod --legacy deploy /app/deployed

# Stage 2: Production runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy the standalone deployed folder
COPY --from=builder /app/deployed ./

# Copy database migrations and schema for runtime prisma migration execution
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

# Install prisma CLI globally for migration deployment
RUN npm install -g prisma@7.1.0

EXPOSE 3001
ENV NODE_ENV=production

# Run database migrations and start the NestJS server
CMD npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma && node dist/main.js
