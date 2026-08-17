import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          // env values are plain strings; the lib wants ms's StringValue
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
            '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    OAuthService,
    // Every route is protected by default; opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
