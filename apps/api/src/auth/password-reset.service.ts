import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const CODE_TTL_MINUTES = 15;
// A 6-digit code has only 1M combinations — cap online guessing hard.
const MAX_ATTEMPTS = 5;

/**
 * Forgot-password flow (WBS 1.1.7, screen 3): email → 6-digit code →
 * new password. Matches the three-step mobile UI. Codes are stored as
 * argon2 hashes in `PasswordResetToken`, single-use, short-lived.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Always answers success — never reveals whether the email exists. */
  async request(email: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const tokenHash = await argon2.hash(code);
      await this.prisma.$transaction([
        // One active code per user: requesting again voids older codes.
        this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        }),
        this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
          },
        }),
      ]);
      await this.mail.sendPasswordResetCode(email, code, CODE_TTL_MINUTES);
    }
    return { success: true };
  }

  /** The mobile UI's middle step: check the code without consuming it. */
  async verify(email: string, code: string): Promise<{ valid: boolean }> {
    const token = await this.findActiveToken(email, code);
    if (!token) {
      throw new BadRequestException('Invalid or expired code');
    }
    return { valid: true };
  }

  async confirm(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const token = await this.findActiveToken(email, code);
    if (!token) {
      throw new BadRequestException('Invalid or expired code');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      // The password changed: end every session on every device.
      this.prisma.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  /** Wrong guesses count toward MAX_ATTEMPTS; over the cap the code dies. */
  private async findActiveToken(
    email: string,
    code: string,
  ): Promise<{ id: string; userId: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return null;
    }
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, tokenHash: true },
    });
    if (!token) {
      return null;
    }
    const matches = await argon2
      .verify(token.tokenHash, code)
      .catch(() => false);
    if (!matches) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      return null;
    }
    return { id: token.id, userId: token.userId };
  }
}
