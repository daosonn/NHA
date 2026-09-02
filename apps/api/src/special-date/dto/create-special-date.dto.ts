import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SpecialDateTheme,
  SpecialDateType,
} from '../../generated/prisma/enums';

export class CreateSpecialDateDto {
  @ApiProperty({ enum: SpecialDateType })
  @IsEnum(SpecialDateType)
  type!: SpecialDateType;

  @ApiProperty({ maxLength: 120, example: '50th anniversary' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ minimum: 1, maximum: 12, description: 'Recurs annually' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({
    minimum: 1,
    maximum: 31,
    description:
      'Must exist in the month (Feb 29 is allowed — non-leap years roll ' +
      'it to Mar 1 at display time, same as derived birthdays)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  day!: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'true ⇒ month/day are Vietnamese LUNAR (âm lịch, tz +7). The solar ' +
      'day is converted per year: leap months are skipped, a missing day ' +
      '30 clamps back to 29 (a giỗ observes the last day of the month).',
  })
  @IsOptional()
  @IsBoolean()
  isLunar?: boolean;

  @ApiPropertyOptional({
    default: true,
    description:
      'false ⇒ one-off: `year` becomes required (in the same calendar as ' +
      'month/day — a LUNAR year when isLunar). A one-off that has passed ' +
      'disappears from lists and never reminds.',
  })
  @IsOptional()
  @IsBoolean()
  repeatsYearly?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1900,
    maximum: 2100,
    description: 'One-off only — the year it happens, in the row calendar.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number | null;

  @ApiPropertyOptional({
    default: 7,
    minimum: 0,
    maximum: 30,
    description:
      'In-app bell reminder lead: notified this many days before AND on ' +
      'the day itself; 0 = day-of only. (Mockup 12c "Remind everyone".)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  remindDaysBefore?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1000,
    maximum: 9999,
    description:
      'Year it first happened — drives the ordinal ("50th"). Omit or null ' +
      'when unknown; then no ordinal is computed.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  originYear?: number | null;

  @ApiProperty({ enum: SpecialDateTheme })
  @IsEnum(SpecialDateTheme)
  theme!: SpecialDateTheme;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Members this occasion is about — must belong to this family. ' +
      'On PATCH the list replaces, like tags everywhere else.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  memberIds?: string[];
}
