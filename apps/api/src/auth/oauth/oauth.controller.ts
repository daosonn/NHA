import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { OAuthService } from './oauth.service';

const STATE_COOKIE = 'oauth_state';
const STATE_COOKIE_PATH = '/api/auth/oauth';
const STATE_TTL_MS = 10 * 60 * 1000;

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

@ApiTags('auth')
@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Public()
  @Get(':provider')
  @ApiOperation({
    summary:
      'Start social login — redirects to the provider consent screen (WBS 1.1.8/1.1.9)',
  })
  start(@Param('provider') providerParam: string, @Res() res: Response): void {
    const provider = this.oauthService.resolveProvider(providerParam);
    const state = this.oauthService.createState();
    // Binds the callback to this browser (CSRF protection for the flow).
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
      path: STATE_COOKIE_PATH,
    });
    res.redirect(this.oauthService.buildAuthorizationUrl(provider, state));
  }

  @Public()
  @Get(':provider/callback')
  @ApiOperation({
    summary:
      'Provider redirect target — verifies state, then returns the token pair',
  })
  async callback(
    @Param('provider') providerParam: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') providerError?: string,
  ): Promise<void> {
    const provider = this.oauthService.resolveProvider(providerParam);
    const cookieState = readCookie(req.headers.cookie, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });

    if (providerError) {
      // e.g. the user cancelled the consent screen
      throw new UnauthorizedException(
        `Login was not completed: ${providerError}`,
      );
    }
    if (!code || !state) {
      throw new BadRequestException('Missing code or state');
    }
    if (!cookieState || cookieState !== state) {
      throw new UnauthorizedException('State mismatch — restart the login');
    }

    const result = await this.oauthService.login(provider, code);
    res.status(HttpStatus.OK).json(result);
  }
}
