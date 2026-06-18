-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('GUEST', 'GOOGLE');

-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ObjectType" AS ENUM ('RECTANGLE', 'CIRCLE', 'LINE', 'TEXT');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('OBJECT_CREATE', 'OBJECT_UPDATE', 'OBJECT_DELETE', 'OBJECT_RESTORE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "avatarUrl" TEXT,
    "avatarColor" VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    "identityType" "IdentityType" NOT NULL DEFAULT 'GUEST',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "currentRevision" BIGINT NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "defaultJoinRole" "BoardRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardMember" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "BoardRole" NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(6),

    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteboardObject" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "type" "ObjectType" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "points" JSONB,
    "text" TEXT,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "style" JSONB NOT NULL,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "WhiteboardObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteboardOperation" (
    "id" UUID NOT NULL,
    "clientOpId" VARCHAR(120) NOT NULL,
    "boardId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "objectId" UUID,
    "revision" BIGINT NOT NULL,
    "type" "OperationType" NOT NULL,
    "baseObjectVersion" INTEGER,
    "payload" JSONB NOT NULL,
    "inversePayload" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhiteboardOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardSnapshot" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "revision" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Board_createdById_idx" ON "Board"("createdById");

-- CreateIndex
CREATE INDEX "Board_isPublic_idx" ON "Board"("isPublic");

-- CreateIndex
CREATE INDEX "Board_deletedAt_idx" ON "Board"("deletedAt");

-- CreateIndex
CREATE INDEX "BoardMember_boardId_role_idx" ON "BoardMember"("boardId", "role");

-- CreateIndex
CREATE INDEX "BoardMember_userId_idx" ON "BoardMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardMember_boardId_userId_key" ON "BoardMember"("boardId", "userId");

-- CreateIndex
CREATE INDEX "WhiteboardObject_boardId_idx" ON "WhiteboardObject"("boardId");

-- CreateIndex
CREATE INDEX "WhiteboardObject_boardId_deletedAt_idx" ON "WhiteboardObject"("boardId", "deletedAt");

-- CreateIndex
CREATE INDEX "WhiteboardObject_boardId_zIndex_idx" ON "WhiteboardObject"("boardId", "zIndex");

-- CreateIndex
CREATE INDEX "WhiteboardObject_createdById_idx" ON "WhiteboardObject"("createdById");

-- CreateIndex
CREATE INDEX "WhiteboardOperation_boardId_revision_idx" ON "WhiteboardOperation"("boardId", "revision");

-- CreateIndex
CREATE INDEX "WhiteboardOperation_objectId_idx" ON "WhiteboardOperation"("objectId");

-- CreateIndex
CREATE INDEX "WhiteboardOperation_actorId_idx" ON "WhiteboardOperation"("actorId");

-- CreateIndex
CREATE INDEX "WhiteboardOperation_createdAt_idx" ON "WhiteboardOperation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhiteboardOperation_boardId_clientOpId_key" ON "WhiteboardOperation"("boardId", "clientOpId");

-- CreateIndex
CREATE UNIQUE INDEX "WhiteboardOperation_boardId_revision_key" ON "WhiteboardOperation"("boardId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "BoardSnapshot_boardId_revision_key" ON "BoardSnapshot"("boardId", "revision");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardObject" ADD CONSTRAINT "WhiteboardObject_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardObject" ADD CONSTRAINT "WhiteboardObject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardObject" ADD CONSTRAINT "WhiteboardObject_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardOperation" ADD CONSTRAINT "WhiteboardOperation_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardOperation" ADD CONSTRAINT "WhiteboardOperation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardOperation" ADD CONSTRAINT "WhiteboardOperation_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "WhiteboardObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardSnapshot" ADD CONSTRAINT "BoardSnapshot_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
