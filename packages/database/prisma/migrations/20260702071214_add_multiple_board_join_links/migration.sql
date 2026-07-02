-- CreateTable
CREATE TABLE "BoardJoinLink" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardJoinLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardJoinLink_token_key" ON "BoardJoinLink"("token");

-- CreateIndex
CREATE INDEX "BoardJoinLink_token_idx" ON "BoardJoinLink"("token");

-- CreateIndex
CREATE INDEX "BoardJoinLink_boardId_idx" ON "BoardJoinLink"("boardId");

-- AddForeignKey
ALTER TABLE "BoardJoinLink" ADD CONSTRAINT "BoardJoinLink_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
