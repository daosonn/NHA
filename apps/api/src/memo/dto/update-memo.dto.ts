import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateMemoDto } from './create-memo.dto';

/** Media is fixed at creation (same rule as posts and life events).
 *  `undefined` = unchanged; content/category accept null = clear. */
export class UpdateMemoDto extends PartialType(
  OmitType(CreateMemoDto, ['mediaIds'] as const),
) {}
