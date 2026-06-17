import { Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import { JwtPayload } from "./auth.type"
import { apiErrorCodes } from "@rctw/shared-contracts"

@Injectable()
export class JWTService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async signAccessToken(payload: JwtPayload): Promise<string> {
    const jwtAccessSecret =
      this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    const jwtAccessExpiresInSeconds = this.configService.getOrThrow<number>(
      "JWT_ACCESS_EXPIRES_IN_SECONDS",
    )

    return this.jwtService.signAsync(payload, {
      secret: jwtAccessSecret,
      expiresIn: jwtAccessExpiresInSeconds,
    })
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const jwtAccessSecret =
      this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    const payload = await this.jwtService.verifyAsync(token, {
      secret: jwtAccessSecret,
    })

    return payload
  }

  getBearerToken(authorizationHeader: string): string {
    const [type, token] = authorizationHeader.split(" ")

    if (type !== "Bearer" || !token) {
      throw this.unauthenticated("Invalid authorization header format.")
    }

    return token
  }

  unauthenticated(message = "Unauthenticated.") {
    return new UnauthorizedException({
      code: apiErrorCodes.UNAUTHENTICATED,
      message,
    })
  }
}
