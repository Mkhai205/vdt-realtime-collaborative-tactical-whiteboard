import { Module } from "@nestjs/common"
import { BoardMemberRepository } from "./repositories/board-member.repository"
import { BoardPermissionService } from "./services/board-permission.service"

@Module({
  providers: [BoardPermissionService, BoardMemberRepository],
  exports: [BoardPermissionService],
})
export class PermissionModule {}
