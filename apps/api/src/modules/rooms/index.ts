/**
 * @deprecated The `rooms/` module has been renamed to `board/`.
 * Import from `../board` instead.
 * This shim is kept for backward compatibility while dependents migrate (Phase 11).
 */
export { BoardModule as RoomsModule } from "../board/board.module"
export { BoardService as RoomsService } from "../board/services/board.service"
export {
  BoardPermissionService as RoomsPermissionService,
} from "../permission/services/board-permission.service"
