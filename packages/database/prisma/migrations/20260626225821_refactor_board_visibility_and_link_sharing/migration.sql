/*
  Warnings:

  - You are about to drop the column `defaultJoinRole` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `Board` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BoardVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "BoardLinkAccess" AS ENUM ('DISABLED', 'VIEWER', 'EDITOR');

-- DropIndex
DROP INDEX "Board_isPublic_idx";

-- AlterTable
ALTER TABLE "Board" DROP COLUMN "defaultJoinRole",
DROP COLUMN "isPublic",
ADD COLUMN     "linkAccess" "BoardLinkAccess" NOT NULL DEFAULT 'EDITOR',
ADD COLUMN     "visibility" "BoardVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "Board_visibility_idx" ON "Board"("visibility");
