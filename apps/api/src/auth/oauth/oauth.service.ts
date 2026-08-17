import { randomBytes } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { OAuthProvider } from '../../generated/prisma/enums';
import { AuthService, type AuthResult } from '../auth.service';

/** Normalized profile shared by all providers. */
interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

interface GoogleTokenResponse {
  id_token?: string;
}

interface GoogleIdTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

interface FacebookTokenResponse {
  access_token?: string;
}

interface FacebookProfileResponse {
  id?: string;
  name?: string;
  email?: string;
}

const FACEBOOK_GRAPH_VERSION = 'v21.0';

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Maps the URL segment (`google`, `facebook`) to a provider, 404 otherwise. */
  resolveProvider(param: string): OAuthProvider {
    const upper = param.toUpperCase();
    if (upper === OAuthProvider.GOOGLE || upper === OAuthProvider.FACEBOOK) {
      return upper;
    }
    throw new NotFoundException(`Unknown login provider: ${param}`);
  }

  createState(): string {
    return randomBytes(24).toString('base64url');
  }

  buildAuthorizationUrl(provider: OAuthProvider, state: string): string {
    const { clientId } = this.credentials(provider);
    if (provider === OAuthProvider.GOOGLE) {
      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: this.redirectUri(provider),
        response_type: 'code',
        scope: 'openid email profile',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
    }
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?${query.toString()}`;
  }

  async login(provider: OAuthProvider, code: string): Promise<AuthResult> {
    const profile =
      provider === OAuthProvider.GOOGLE
        ? await this.fetchGoogleProfile(code)
        : await this.fetchFacebookProfile(code);

    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (account) {
      return this.authService.issueTokens(
        account.user.id,
        account.user.email,
        account.user.name,
      );
    }

    // Email-required policy (docs/02-backend/architecture.md).
    if (!profile.email || !profile.emailVerified) {
      throw new UnauthorizedException(
        'The provider did not return a verified email; log in another way',
      );
    }

    // No-auto-linking policy (docs/02-backend/architecture.md).
    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Email is already registered — log in with email and password',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        // Social-only account: password login treats an empty hash as a
        // wrong password (see AuthService.login).
        passwordHash: '',
        name: profile.name ?? profile.email.split('@')[0],
        lifeProfile: { create: {} },
        oauthAccounts: {
          create: { provider, providerAccountId: profile.providerAccountId },
        },
      },
    });
    return this.authService.issueTokens(user.id, user.email, user.name);
  }

  private credentials(provider: OAuthProvider): {
    clientId: string;
    clientSecret: string;
  } {
    const clientId = this.config.get<string>(`${provider}_CLIENT_ID`);
    const clientSecret = this.config.get<string>(`${provider}_CLIENT_SECRET`);
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        `${provider} login is not configured on this server`,
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(provider: OAuthProvider): string {
    // Must match the redirect URI registered with the provider.
    const base =
      this.config.get<string>('OAUTH_REDIRECT_BASE_URL') ??
      'http://localhost:3000';
    return `${base}/api/auth/oauth/${provider.toLowerCase()}/callback`;
  }

  private async fetchGoogleProfile(code: string): Promise<OAuthProfile> {
    const { clientId, clientSecret } = this.credentials(OAuthProvider.GOOGLE);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri(OAuthProvider.GOOGLE),
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) {
      throw new UnauthorizedException('Google rejected the authorization code');
    }
    const data = (await response.json()) as GoogleTokenResponse;
    if (!data.id_token) {
      throw new BadGatewayException('Google token response has no id_token');
    }
    // The id_token comes straight from Google's token endpoint over TLS, so
    // decoding without a signature check is allowed (OIDC Core §3.1.3.7).
    const payload = this.decodeJwtPayload(
      data.id_token,
    ) as GoogleIdTokenPayload;
    if (!payload.sub) {
      throw new BadGatewayException('Google id_token has no subject');
    }
    return {
      providerAccountId: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }

  private async fetchFacebookProfile(code: string): Promise<OAuthProfile> {
    const { clientId, clientSecret } = this.credentials(OAuthProvider.FACEBOOK);
    const tokenQuery = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.redirectUri(OAuthProvider.FACEBOOK),
      code,
    });
    const tokenResponse = await fetch(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token?${tokenQuery.toString()}`,
    );
    if (!tokenResponse.ok) {
      throw new UnauthorizedException(
        'Facebook rejected the authorization code',
      );
    }
    const token = (await tokenResponse.json()) as FacebookTokenResponse;
    if (!token.access_token) {
      throw new BadGatewayException(
        'Facebook token response has no access_token',
      );
    }
    const profileQuery = new URLSearchParams({
      fields: 'id,name,email',
      access_token: token.access_token,
    });
    const profileResponse = await fetch(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?${profileQuery.toString()}`,
    );
    if (!profileResponse.ok) {
      throw new BadGatewayException('Could not load the Facebook profile');
    }
    const profile = (await profileResponse.json()) as FacebookProfileResponse;
    if (!profile.id) {
      throw new BadGatewayException('Facebook profile response has no id');
    }
    return {
      providerAccountId: profile.id,
      email: profile.email ?? null,
      // Facebook only exposes verified emails through the Graph API.
      emailVerified: Boolean(profile.email),
      name: profile.name ?? null,
    };
  }

  private decodeJwtPayload(jwt: string): unknown {
    const segments = jwt.split('.');
    if (segments.length !== 3) {
      throw new BadGatewayException('Malformed id_token');
    }
    try {
      return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
    } catch {
      throw new BadGatewayException('Malformed id_token payload');
    }
  }
}
