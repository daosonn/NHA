import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLifeEventDto } from './create-life-event.dto';

/** Media is fixed at creation (same rule as posts); everything else is
 *  wiki-editable. `undefined` = unchanged. */
export class UpdateLifeEventDto extends PartialType(
  OmitType(CreateLifeEventDto, ['mediaIds'] as const),
) {}
