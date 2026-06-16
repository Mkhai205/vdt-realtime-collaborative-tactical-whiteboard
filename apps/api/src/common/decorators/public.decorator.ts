import { SetMetadata } from "@nestjs/common"

export const IS_PUBLIC_KEY = "isPublic"

/**
 * Mark a route as public — bypasses the global AuthGuard.
 * Used on endpoints like OAuth callback that don't require authentication.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
