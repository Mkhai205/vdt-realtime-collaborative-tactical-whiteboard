/**
 * @deprecated This module has been replaced by `board/`.
 * All exports below are backward-compatibility re-exports only.
 * Remove usages and import from `../board` directly.
 */

// Re-export module and service for dependents not yet migrated
export { BoardModule as RoomsModule } from "../board/board.module"
export { BoardService as RoomsService } from "../board/services/board.service"
export { BoardPermissionService as RoomsPermissionService } from "../permission/services/board-permission.service"
