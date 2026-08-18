import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReactionType } from '../../generated/prisma/enums';

export class SetReactionDto {
  @ApiProperty({ enum: ReactionType })
  @IsEnum(ReactionType)
  type!: ReactionType;
}
