CREATE TYPE "IdentityType" AS ENUM ('GUEST', 'GOOGLE');

CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "avatarUrl" TEXT,
    "avatarColor" VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    "identityType" "IdentityType" NOT NULL DEFAULT 'GUEST',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
