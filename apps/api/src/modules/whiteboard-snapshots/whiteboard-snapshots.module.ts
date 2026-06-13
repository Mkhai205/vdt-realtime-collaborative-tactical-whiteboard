import { Module } from "@nestjs/common"
import { WhiteboardSnapshotsService } from "./whiteboard-snapshots.service"

@Module({
  providers: [WhiteboardSnapshotsService],
  exports: [WhiteboardSnapshotsService],
})
export class WhiteboardSnapshotsModule {}
