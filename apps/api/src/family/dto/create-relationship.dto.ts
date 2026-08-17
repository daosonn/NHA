import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RelationshipType } from '../../generated/prisma/enums';

export class CreateRelationshipDto {
  @ApiProperty({ description: 'For PARENT: this member is the parent' })
  @IsUUID()
  fromMemberId!: string;

  @ApiProperty({ description: 'For PARENT: this member is the child' })
  @IsUUID()
  toMemberId!: string;

  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  type!: RelationshipType;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Free label when type = OTHER',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
