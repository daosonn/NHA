import { PartialType } from '@nestjs/swagger';
import { CreateSpecialDateDto } from './create-special-date.dto';

/** Omitted = unchanged; `originYear: null` clears it; `memberIds` replaces
 *  the whole list. Changing only `month` or only `day` is validated
 *  against the resulting combination. */
export class UpdateSpecialDateDto extends PartialType(CreateSpecialDateDto) {}
