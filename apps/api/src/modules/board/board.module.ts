import { Module } from "@nestjs/common"
import { BoardController } from "./controllers/board.controller"
import { BoardMemberController } from "./controllers/board-member.controller"
import { BoardShareLinkController } from "./controllers/board-share-link.controller"
import { BoardInvitationController } from "./controllers/board-invitation.controller"
import { UploadController } from "./controllers/upload.controller"
import { BoardService } from "./service/board.service"
import { BoardMemberService } from "./service/board-member.service"
import { BoardPermissionService } from "./service/board-permission.service"
import { WhiteboardQueryService } from "./service/board-operation.service"
import { WhiteboardMutationService } from "./service/board-objects.service"
import { BoardSnapshotService } from "./service/board-snapshot.service"
import { BoardShareLinkService } from "./service/board-share-link.service"
import { BoardInvitationService } from "./service/board-invitation.service"
import { BoardEventsService } from "./service/board-events.service"

@Module({
  controllers: [
    BoardController,
    BoardMemberController,
    BoardShareLinkController,
    BoardInvitationController,
    UploadController,
  ],
  providers: [
    BoardService,
    BoardMemberService,
    BoardPermissionService,
    WhiteboardQueryService,
    WhiteboardMutationService,
    BoardSnapshotService,
    BoardShareLinkService,
    BoardInvitationService,
    BoardEventsService,
  ],
  exports: [
    BoardService,
    BoardMemberService,
    BoardPermissionService,
    WhiteboardQueryService,
    WhiteboardMutationService,
    BoardSnapshotService,
    BoardShareLinkService,
    BoardInvitationService,
    BoardEventsService,
  ],
})
export class BoardModule {}
