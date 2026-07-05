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

# Build shared contracts
RUN pnpm --filter @rctw/shared-contracts build

# Build-time environment variables for Next.js (baked into client-side build bundle)
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Build Next.js Web App
RUN pnpm --filter @rctw/web build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10.33.2

WORKDIR /app

# Copy built workspace from builder
COPY --from=builder /app ./

EXPOSE 3000
ENV NODE_ENV=production

# Start the Next.js server
CMD pnpm --filter @rctw/web start
