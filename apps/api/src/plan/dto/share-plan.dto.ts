import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SharePlanDto {
  @ApiProperty({
    description:
      'The account to share with — sharing is view-only, and only with ' +
      'someone in one of your families (`FamilyMemberSummary.userId`; a ' +
      'placeholder member has none and cannot be shared with)',
  })
  @IsUUID()
  userId!: string;
}
