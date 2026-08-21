import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
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
