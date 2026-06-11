-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoomMember" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoomSnapshot" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WhiteboardObject" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WhiteboardOperation" ALTER COLUMN "id" DROP DEFAULT;
