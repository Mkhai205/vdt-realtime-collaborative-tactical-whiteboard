import { IdentityType } from "./user"

export type JwtPayload = {
  sub: string
  name: string
  email: string | null
  identityType: IdentityType
}
