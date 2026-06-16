-- ============================================================
-- Migration: rename_room_to_board
-- Handles actual DB state after partial apply:
--   DONE: BoardRole enum, boards table, board_members table
--   TODO: RoomSnapshot, WhiteboardObject, WhiteboardOperation
-- ============================================================

-- boards table: rename remaining old-named FK and indexes
ALTER TABLE "boards" RENAME CONSTRAINT "Room_createdById_fkey" TO "boards_createdById_fkey";
ALTER INDEX "Room_createdById_idx" RENAME TO "boards_createdById_idx";
ALTER INDEX "Room_isPublic_idx" RENAME TO "boards_isPublic_idx";
ALTER INDEX "Room_deletedAt_idx" RENAME TO "boards_deletedAt_idx";

-- board_members table: rename remaining old-named indexes
ALTER INDEX "RoomMember_roomId_userId_key" RENAME TO "board_members_boardId_userId_key";
ALTER INDEX "RoomMember_roomId_role_idx" RENAME TO "board_members_boardId_role_idx";
ALTER INDEX "RoomMember_userId_idx" RENAME TO "board_members_userId_idx";

-- RoomSnapshot → board_snapshots
ALTER TABLE "RoomSnapshot" RENAME TO "board_snapshots";
ALTER TABLE "board_snapshots" RENAME CONSTRAINT "RoomSnapshot_pkey" TO "board_snapshots_pkey";
ALTER TABLE "board_snapshots" RENAME CONSTRAINT "RoomSnapshot_roomId_fkey" TO "board_snapshots_boardId_fkey";
ALTER TABLE "board_snapshots" RENAME COLUMN "roomId" TO "boardId";
ALTER INDEX "RoomSnapshot_roomId_revision_key" RENAME TO "board_snapshots_boardId_revision_key";

-- WhiteboardObject: rename column roomId → boardId
ALTER TABLE "WhiteboardObject" RENAME COLUMN "roomId" TO "boardId";
ALTER TABLE "WhiteboardObject" RENAME CONSTRAINT "WhiteboardObject_roomId_fkey" TO "WhiteboardObject_boardId_fkey";
ALTER INDEX "WhiteboardObject_roomId_idx" RENAME TO "WhiteboardObject_boardId_idx";
ALTER INDEX "WhiteboardObject_roomId_deletedAt_idx" RENAME TO "WhiteboardObject_boardId_deletedAt_idx";
ALTER INDEX "WhiteboardObject_roomId_zIndex_idx" RENAME TO "WhiteboardObject_boardId_zIndex_idx";

-- WhiteboardOperation: rename column roomId → boardId
ALTER TABLE "WhiteboardOperation" RENAME COLUMN "roomId" TO "boardId";
ALTER TABLE "WhiteboardOperation" RENAME CONSTRAINT "WhiteboardOperation_roomId_fkey" TO "WhiteboardOperation_boardId_fkey";
ALTER INDEX "WhiteboardOperation_roomId_clientOpId_key" RENAME TO "WhiteboardOperation_boardId_clientOpId_key";
ALTER INDEX "WhiteboardOperation_roomId_revision_key" RENAME TO "WhiteboardOperation_boardId_revision_key";
ALTER INDEX "WhiteboardOperation_roomId_revision_idx" RENAME TO "WhiteboardOperation_boardId_revision_idx";
