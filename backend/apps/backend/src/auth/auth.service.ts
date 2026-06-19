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

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.avatarUrl,
    };
  }

  async updateUser(userId: string, data: { name?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.avatarUrl,
    };
  }

  async deleteUser(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });
    return { success: true };
  }
}
