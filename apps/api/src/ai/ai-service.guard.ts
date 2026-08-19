import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Service-to-service auth for the `/internal/ai/*` routes
 * (docs/03-ai/architecture.md): the AI team's FastAPI presents the shared
 * secret in `X-AI-Service-Token`. These routes are marked @Public to skip
 * the user-JWT guard — a bearer token must never open them, and this
 * token must never open user routes; the two credential worlds stay
 * disjoint.
 */
@Injectable()
export class AiServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('AI_SERVICE_TOKEN');
    if (!expected) {
      // Not configured (e.g. local dev without the AI service): the
      // integration is off, not misauthenticated.
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
    }
    const request = context.switchToHttp().getRequest<Request>();
    const presented = request.header('x-ai-service-token') ?? '';
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    // timingSafeEqual demands equal lengths; the length check itself
    // leaks nothing useful about the secret's content.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid service token');
    }
    return true;
  }
}
