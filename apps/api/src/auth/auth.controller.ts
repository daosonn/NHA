import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, type AuthResult } from './auth.service';
import {
  CurrentUser,
  type AuthUser,
} from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account (WBS 1.1.2)' })
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password (WBS 1.1.5)' })
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResult> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  @ApiOperation({
    summary:
      'Email a 6-digit reset code — responds success whether or not the email exists (WBS 1.1.7)',
  })
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ success: boolean }> {
    return this.passwordResetService.request(dto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/verify')
  @ApiOperation({
    summary: 'Check a reset code without consuming it (the middle UI step)',
  })
  verifyResetCode(
    @Body() dto: VerifyResetCodeDto,
  ): Promise<{ valid: boolean }> {
    return this.passwordResetService.verify(dto.email, dto.code);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/confirm')
  @ApiOperation({
    summary:
      'Set a new password with a valid code; revokes every session (WBS 1.1.7)',
  })
  confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<{ success: boolean }> {
    return this.passwordResetService.confirm(
      dto.email,
      dto.code,
      dto.newPassword,
    );
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token (WBS 1.1.6)' })
  logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<{ success: boolean }> {
    return this.authService.logout(user.userId, dto.refreshToken);
  }
}
