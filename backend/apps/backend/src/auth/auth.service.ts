import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async validateOAuthUser(profile: { email: string; name: string; avatarUrl: string; providerId: string; provider: AuthProvider }) {
    let user = await this.prisma.user.findUnique({
      where: { providerId: profile.providerId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          providerId: profile.providerId,
          provider: profile.provider,
        },
      });
    }

    return user;
  }

  generateJwt(userId: string) {
    return this.jwtService.sign({ sub: userId });
  }
}
