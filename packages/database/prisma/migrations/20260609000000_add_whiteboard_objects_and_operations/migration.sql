CREATE TYPE "ObjectType" AS ENUM ('RECTANGLE', 'CIRCLE', 'LINE', 'TEXT');

CREATE TYPE "OperationType" AS ENUM ('OBJECT_CREATE', 'OBJECT_UPDATE', 'OBJECT_DELETE', 'OBJECT_RESTORE');

CREATE TABLE "WhiteboardObject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
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

CREATE TABLE "WhiteboardOperation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientOpId" VARCHAR(120) NOT NULL,
    "roomId" UUID NOT NULL,
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

CREATE INDEX "WhiteboardObject_roomId_idx" ON "WhiteboardObject"("roomId");
CREATE INDEX "WhiteboardObject_roomId_deletedAt_idx" ON "WhiteboardObject"("roomId", "deletedAt");
CREATE INDEX "WhiteboardObject_roomId_zIndex_idx" ON "WhiteboardObject"("roomId", "zIndex");
CREATE INDEX "WhiteboardObject_createdById_idx" ON "WhiteboardObject"("createdById");

CREATE UNIQUE INDEX "WhiteboardOperation_roomId_clientOpId_key" ON "WhiteboardOperation"("roomId", "clientOpId");
CREATE UNIQUE INDEX "WhiteboardOperation_roomId_revision_key" ON "WhiteboardOperation"("roomId", "revision");
CREATE INDEX "WhiteboardOperation_roomId_revision_idx" ON "WhiteboardOperation"("roomId", "revision");
CREATE INDEX "WhiteboardOperation_objectId_idx" ON "WhiteboardOperation"("objectId");
CREATE INDEX "WhiteboardOperation_actorId_idx" ON "WhiteboardOperation"("actorId");
CREATE INDEX "WhiteboardOperation_createdAt_idx" ON "WhiteboardOperation"("createdAt");

ALTER TABLE "WhiteboardObject" ADD CONSTRAINT "WhiteboardObject_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhiteboardObject" ADD CONSTRAINT "WhiteboardObject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhiteboardObject" ADD CONSTRAINT "WhiteboardObject_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhiteboardOperation" ADD CONSTRAINT "WhiteboardOperation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhiteboardOperation" ADD CONSTRAINT "WhiteboardOperation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhiteboardOperation" ADD CONSTRAINT "WhiteboardOperation_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "WhiteboardObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
