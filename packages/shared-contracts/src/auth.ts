import { IdentityType } from "./user"

export type JwtPayload = {
  id: string
  name: string
  email: string | null
  identityType: IdentityType
}
