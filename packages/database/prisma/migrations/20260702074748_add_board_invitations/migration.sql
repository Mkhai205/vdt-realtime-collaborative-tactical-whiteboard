-- CreateTable
CREATE TABLE "BoardInvitation" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "BoardRole" NOT NULL DEFAULT 'EDITOR',
    "token" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardInvitation_token_key" ON "BoardInvitation"("token");

-- CreateIndex
CREATE INDEX "BoardInvitation_token_idx" ON "BoardInvitation"("token");

-- CreateIndex
CREATE INDEX "BoardInvitation_boardId_idx" ON "BoardInvitation"("boardId");

-- CreateIndex
CREATE INDEX "BoardInvitation_invitedById_idx" ON "BoardInvitation"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "BoardInvitation_boardId_email_key" ON "BoardInvitation"("boardId", "email");

-- AddForeignKey
ALTER TABLE "BoardInvitation" ADD CONSTRAINT "BoardInvitation_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardInvitation" ADD CONSTRAINT "BoardInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
