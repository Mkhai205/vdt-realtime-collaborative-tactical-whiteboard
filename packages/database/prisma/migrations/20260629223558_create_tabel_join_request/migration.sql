/*
  Warnings:

  - You are about to drop the column `linkAccess` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `removedAt` on the `BoardMember` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Board" DROP COLUMN "linkAccess";

-- AlterTable
ALTER TABLE "BoardMember" DROP COLUMN "removedAt";

-- DropEnum
DROP TYPE "BoardLinkAccess";

-- CreateTable
CREATE TABLE "BoardJoinRequest" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardJoinRequest_boardId_idx" ON "BoardJoinRequest"("boardId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardJoinRequest_boardId_userId_key" ON "BoardJoinRequest"("boardId", "userId");

-- CreateIndex
CREATE INDEX "BoardSnapshot_boardId_createdAt_idx" ON "BoardSnapshot"("boardId", "createdAt");

-- AddForeignKey
ALTER TABLE "BoardJoinRequest" ADD CONSTRAINT "BoardJoinRequest_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardJoinRequest" ADD CONSTRAINT "BoardJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
