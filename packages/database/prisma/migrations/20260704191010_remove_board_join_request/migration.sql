/*
  Warnings:

  - You are about to drop the `BoardJoinRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BoardJoinRequest" DROP CONSTRAINT "BoardJoinRequest_boardId_fkey";

-- DropForeignKey
ALTER TABLE "BoardJoinRequest" DROP CONSTRAINT "BoardJoinRequest_userId_fkey";

-- DropTable
DROP TABLE "BoardJoinRequest";

-- DropEnum
DROP TYPE "JoinRequestStatus";
