import { Module } from "@nestjs/common"
import { DatabaseModule } from "../../infrastructure/database"
import { WhiteboardSnapshotsService } from "./whiteboard-snapshots.service"

@Module({
  imports: [DatabaseModule],
  providers: [WhiteboardSnapshotsService],
  exports: [WhiteboardSnapshotsService],
})
export class WhiteboardSnapshotsModule {}
