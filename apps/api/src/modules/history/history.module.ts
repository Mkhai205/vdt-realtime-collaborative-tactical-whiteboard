import { Module } from "@nestjs/common"
import { HistoryService } from "./services/history.service"
import { WhiteboardModule } from "../whiteboard/whiteboard.module"

@Module({
  imports: [WhiteboardModule],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
