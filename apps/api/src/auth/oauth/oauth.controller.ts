import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpException,
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
/**
 * Where to send the caller once the provider is done, remembered across the
 * round trip. It cannot ride on the callback's query string — the provider
 * decides what that contains — and it is kept out of `state` so nothing a
 * provider might normalise can change where credentials are delivered.
 */
const REDIRECT_COOKIE = 'oauth_redirect';
const STATE_COOKIE_PATH = '/api/auth/oauth';
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * A short code the app can translate, instead of the server's English.
 *
 * Sending the message itself would put one untranslated sentence in the
 * middle of a Japanese screen; sending a status code alone would lose the
 * difference between "that address already has a password" and "the provider
 * would not tell us your address", which are different things to be told.
 */
function failureCode(error: unknown): string {
  if (error instanceof ConflictException) return 'email_taken';
  if (error instanceof UnauthorizedException) return 'rejected';
  if (error instanceof BadRequestException) return 'incomplete';
  return 'failed';
}

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
  start(
    @Param('provider') providerParam: string,
    @Res() res: Response,
    @Query('redirect') redirect?: string,
  ): void {
    const provider = this.oauthService.resolveProvider(providerParam);
    // Validated against an allowlist here, at the door, so an address that
    // was never permitted cannot reach the callback at all.
    const appRedirect = this.oauthService.resolveAppRedirect(redirect);
    const state = this.oauthService.createState();

    const cookie = {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
      path: STATE_COOKIE_PATH,
    } as const;

    // Binds the callback to this browser (CSRF protection for the flow).
    res.cookie(STATE_COOKIE, state, cookie);
    if (appRedirect) {
      res.cookie(REDIRECT_COOKIE, appRedirect, cookie);
    }

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
    const appRedirect = readCookie(req.headers.cookie, REDIRECT_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
    res.clearCookie(REDIRECT_COOKIE, { path: STATE_COOKIE_PATH });

    // Everything from here can fail, and when a client is waiting to be
    // redirected it has to be told **in the app**. Throwing instead leaves
    // somebody stranded on a JSON page at an API address with no way back —
    // which is exactly what a rejected sign-in looked like before this.
    const fail = (error: unknown): void => {
      if (!appRedirect) throw error;

      const params = new URLSearchParams({ error: failureCode(error) });
      // Their own address, so the sign-in screen can fill it in for them.
      // The fragment never reaches a server.
      if (error instanceof ConflictException) {
        const body = error.getResponse();
        const email =
          typeof body === 'object' && body !== null && 'email' in body
            ? String(body.email)
            : null;
        if (email) params.set('email', email);
      }
      res.redirect(`${appRedirect}#${params.toString()}`);
    };

    try {
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
      this.succeed(res, appRedirect, result);
    } catch (error) {
      if (error instanceof HttpException) {
        fail(error);
        return;
      }
      throw error;
    }
  }

  /** The happy path, split out so the try block above stays readable. */
  private succeed(
    res: Response,
    appRedirect: string | null,
    result: Awaited<ReturnType<OAuthService['login']>>,
  ): void {
    if (appRedirect) {
      // The fragment, not the query string: everything after `#` stays in the
      // browser. It is not sent to the server, does not reach an access log,
      // and is not passed on in `Referer` — which matters when the thing
      // being carried is a refresh token.
      // The account travels with the tokens because the API has no
      // "who am I" route: `/me/profile` answers with a display name and no
      // address, and the app shows the signed-in email in Settings. A
      // `GET /me` returning `AuthenticatedUser` would be the tidier answer
      // and is worth adding; until then this is the only way the client can
      // know who it just signed in as.
      const tokens = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
      });
      res.redirect(`${appRedirect}#${tokens.toString()}`);
      return;
    }

    // No client asked to be redirected: answer as before, which is what
    // Swagger and a browser test see.
    res.status(HttpStatus.OK).json(result);
  }
}
