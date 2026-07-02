import { Module } from "@nestjs/common"
import { BoardController } from "./controllers/board.controller"
import { BoardMemberController } from "./controllers/board-member.controller"
import { BoardDataController } from "./controllers/board-data.controller"
import { BoardJoinRequestController } from "./controllers/board-join-request.controller"
import { BoardShareLinkController } from "./controllers/board-share-link.controller"
import { BoardService } from "./service/board.service"
import { BoardMemberService } from "./service/board-member.service"
import { BoardPermissionService } from "./service/board-permission.service"
import { WhiteboardQueryService } from "./service/board-operation.service"
import { WhiteboardMutationService } from "./service/board-objects.service"
import { BoardSnapshotService } from "./service/board-snapshot.service"
import { BoardJoinRequestService } from "./service/board-join-request.service"
import { BoardShareLinkService } from "./service/board-share-link.service"

@Module({
  controllers: [
    BoardController,
    BoardMemberController,
    BoardDataController,
    BoardJoinRequestController,
    BoardShareLinkController,
  ],
  providers: [
    BoardService,
    BoardMemberService,
    BoardPermissionService,
    WhiteboardQueryService,
    WhiteboardMutationService,
    BoardSnapshotService,
    BoardJoinRequestService,
    BoardShareLinkService,
  ],
  exports: [
    BoardService,
    BoardMemberService,
    BoardPermissionService,
    WhiteboardQueryService,
    WhiteboardMutationService,
    BoardSnapshotService,
    BoardJoinRequestService,
    BoardShareLinkService,
  ],
})
export class BoardModule {}
