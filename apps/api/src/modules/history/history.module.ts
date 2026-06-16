import { Module } from "@nestjs/common"
import { WhiteboardModule } from "../whiteboard"
import { HistoryService } from "./services/history.service"

@Module({
  imports: [WhiteboardModule],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
