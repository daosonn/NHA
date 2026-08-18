import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({ example: 'hanako@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '482913',
    description: '6-digit code from the email',
  })
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code!: string;
}
