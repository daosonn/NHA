import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    const days = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? '30');
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        // One global Life Profile per person, created with the account
        // (docs/00-shared/domain-model.md).
        lifeProfile: { create: {} },
      },
    });

    return this.issueTokens(user.id, user.email, user.name);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // A malformed stored hash (e.g. pre-schema backfilled accounts with an
    // empty hash) must read as "wrong password", not a 500.
    const passwordValid = await argon2
      .verify(user.passwordHash, dto.password)
      .catch(() => false);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, user.email, user.name);
  }

  /** Rotation: the presented refresh token is single-use. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.name,
    );
  }

  async logout(
    userId: string,
    refreshToken: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /** Shared with OAuthService — social logins issue the same token pair. */
  async issueTokens(
    id: string,
    email: string,
    name: string,
  ): Promise<AuthResult> {
    const accessToken = await this.jwtService.signAsync({ sub: id, email });

    // Opaque random refresh token; only its hash is stored
    // (docs/02-backend/architecture.md).
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    return { user: { id, email, name }, accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
