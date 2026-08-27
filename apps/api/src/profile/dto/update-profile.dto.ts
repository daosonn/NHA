import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';

/** Omitted fields stay unchanged; `null` clears a date, `''` clears the bio. */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Display name. On your own profile this renames the account ' +
      '(User.name); on a placeholder it renames that family-local member ' +
      '(FamilyMember.displayName). Cannot be cleared — a person always has ' +
      'a name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Avatar: the id of an image the CALLER uploaded via POST /media ' +
      '(WBS 3.4.2). Read it back on ProfileDetail/FamilyMemberSummary as ' +
      'avatarKey and stream it via GET /media/:id. null clears it.',
  })
  @IsOptional()
  @IsUUID()
  avatarMediaId?: string | null;

  @ApiPropertyOptional({
    maxLength: 5000,
    description: 'Empty string clears the bio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replaces the full interests list; empty array clears it',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  interests?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Date only, YYYY-MM-DD; null clears it (one source per person)',
  })
  @IsOptional()
  @IsDateOnly('birthDate')
  birthDate?: string | null;

  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    example: 'Ý Yên, Nam Định',
    description:
      'Where they were born — free text, printed after the birth date ' +
      '(mockup 7). Empty string or null clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  birthPlace?: string | null;

  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    example: 'Carpenter, retired since 2021',
    description:
      'Free text, not a job title — the mockup prints a whole phrase. ' +
      'Empty string or null clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  occupation?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Date only, YYYY-MM-DD; null clears it. Deceased members only',
  })
  @IsOptional()
  @IsDateOnly('deathDate')
  deathDate?: string | null;
}
