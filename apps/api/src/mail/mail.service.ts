import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Email delivery behind one seam. MVP transport is plain SMTP — team
 * decision 2026-08-18: Gmail SMTP with an app password — configured via
 * env; swapping providers later only changes the env values.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const port = Number(config.get<string>('SMTP_PORT') || '587');
    this.from = config.get<string>('MAIL_FROM') || user || 'no-reply@nha.local';
    this.transporter =
      host && user && pass
        ? createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          })
        : null;
  }

  /**
   * Without SMTP config (local dev) the code is logged to the server
   * console instead of sent — never enable that path in production.
   */
  async sendPasswordResetCode(
    to: string,
    code: string,
    expiresMinutes: number,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured — password reset code for ${to}: ${code}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'NHA password reset code',
      text:
        `Your NHA password reset code is ${code}. ` +
        `It expires in ${expiresMinutes} minutes. ` +
        'If you did not request this, you can ignore this email.',
    });
  }
}
