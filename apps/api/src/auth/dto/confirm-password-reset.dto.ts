import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { VerifyResetCodeDto } from './verify-reset-code.dto';

export class ConfirmPasswordResetDto extends VerifyResetCodeDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    example: 'correct-horse-battery',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
