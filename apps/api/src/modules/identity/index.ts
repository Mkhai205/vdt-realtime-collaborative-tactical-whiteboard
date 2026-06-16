/**
 * @deprecated This module has been renamed to `auth/`.
 * Import from `../auth` instead.
 * This file is kept as a shim for backward compatibility
 * until all dependents are migrated (Phase 4-11).
 */

// Re-export new AuthModule as IdentityModule alias for backward compat
export { AuthModule as IdentityModule } from "../auth/auth.module"
export { AuthService as IdentityService } from "../auth/services/auth.service"
export { AuthGuard as IdentityGuard } from "../auth/guards/auth.guard"

// Re-export unchanged items
export * from "../auth/services/oauth.service"
export * from "../../common/decorators/current-user.decorator"
export * from "./identity.types"
