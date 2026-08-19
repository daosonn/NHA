import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CardTemplateId } from '../card.service';

/** Màn 26 (11g) — "Five designs, live preview" → render PNG server-side */
export class CardRenderDto {
  @IsIn(['marigold', 'birthday', 'tulip', 'tet', 'kraft'])
  template!: CardTemplateId;

  @IsString()
  @MaxLength(600)
  message!: string;

  @IsString()
  @MaxLength(40)
  toName!: string;

  @IsString()
  @MaxLength(40)
  fromName!: string;

  /** dòng nhỏ phía trên "Dear …" — vd "BIRTHDAY" */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  heading?: string;
}
