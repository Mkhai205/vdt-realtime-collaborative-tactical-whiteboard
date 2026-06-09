CREATE TABLE "RoomSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "revision" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomSnapshot_roomId_revision_key" ON "RoomSnapshot"("roomId", "revision");

ALTER TABLE "RoomSnapshot" ADD CONSTRAINT "RoomSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
