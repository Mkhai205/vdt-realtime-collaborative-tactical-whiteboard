import { Injectable } from "@nestjs/common"
import {
  avatarPalette,
  identityTypes,
  type UserSummary,
} from "@rctw/shared-contracts"
import { PrismaService } from "../../infrastructure/database"
import { JWTService } from "./jwt.service"

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  avatarColor: true,
  identityType: true,
} as const

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JWTService,
  ) {}

  async registerGuest(): Promise<{ accessToken: string; user: UserSummary }> {
    const guestName = `Guest_${Math.floor(1000 + Math.random() * 9000)}`
    const guestAvatarColor =
      avatarPalette[Math.floor(Math.random() * avatarPalette.length)] ??
      "#3B82F6"

    const guest = await this.prisma.user.create({
      data: {
        name: guestName,
        avatarColor: guestAvatarColor,
        identityType: identityTypes.GUEST,
      },
      select: userSummarySelect,
    })

    const accessToken = await this.jwtService.signAccessToken({
      sub: guest.id,
      name: guest.name,
      email: guest.email,
      avatarUrl: guest.avatarUrl,
      avatarColor: guest.avatarColor,
      identityType: guest.identityType,
    })

    return { accessToken, user: guest }
  }
}
