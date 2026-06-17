import { IdentityType } from "@rctw/shared-contracts"

export type JwtPayload = {
  sub: string
  name: string
  email: string | null
  avatarUrl: string | null
  avatarColor: string
  identityType: IdentityType
}
