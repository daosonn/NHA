import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RelationshipType } from '../../generated/prisma/enums';

export class CreateInvitationDto {
  @ApiProperty({
    maxLength: 50,
    description: 'What the inviter calls the invitee — shown on both sides',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Email of the person being invited. They must already have an account: ' +
      'the invitation reaches them as an in-app notification, which is the ' +
      'only delivery this build has. Omit it to get a code you hand over ' +
      'yourself, which is how invitations worked before.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Existing placeholder member to reserve as the spot. Omitted = the ' +
      'server creates the placeholder (and its relationship edge) itself.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiProperty({
    enum: RelationshipType,
    description: 'Base edge stored on Relationship — never a kinship word',
  })
  @IsEnum(RelationshipType)
  relationshipType!: RelationshipType;

  @ApiPropertyOptional({
    maxLength: 30,
    description:
      'Kinship picker key ("sister", "step-parent") — display-only, the ' +
      'client translates it; must never become a RelationshipType',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  kinshipKey?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Which end of the stored edge the invitee sits on, relative to the ' +
      'inviter. PARENT points parent→child, so "Mother" is true and ' +
      '"Daughter" is false. Ignored when memberId is given (the spot is ' +
      'already placed in the tree).',
  })
  @IsOptional()
  @IsBoolean()
  newMemberIsFrom?: boolean;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Free label for the edge when relationshipType = OTHER',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationshipLabel?: string;
}
