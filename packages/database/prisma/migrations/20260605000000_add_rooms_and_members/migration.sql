CREATE TYPE "RoomRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

CREATE TABLE "Room" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "currentRevision" BIGINT NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "defaultJoinRole" "RoomRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "RoomRole" NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(6),

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Room_createdById_idx" ON "Room"("createdById");
CREATE INDEX "Room_isPublic_idx" ON "Room"("isPublic");
CREATE INDEX "Room_deletedAt_idx" ON "Room"("deletedAt");

CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");
CREATE INDEX "RoomMember_roomId_role_idx" ON "RoomMember"("roomId", "role");
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");

ALTER TABLE "Room" ADD CONSTRAINT "Room_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
