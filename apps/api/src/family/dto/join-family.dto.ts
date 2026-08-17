import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class JoinFamilyDto {
  @ApiProperty({ example: 'ABCD2345' })
  @IsString()
  @IsNotEmpty()
  inviteCode!: string;

  @ApiPropertyOptional({
    description:
      'Placeholder member in the family to link this account to (domain-model.md: linking keeps attached content)',
  })
  @IsOptional()
  @IsUUID()
  linkMemberId?: string;
}
