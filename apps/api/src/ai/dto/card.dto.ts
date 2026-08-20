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

  /**
   * dòng nhỏ phía trên "Dear …" — vd "BIRTHDAY". Mobile gửi thẳng tên dịp người
   * dùng tự thêm (tới 80 ký tự) — cap 30 từng làm "Save the card" chết im lặng
   * vì 400 validation; hiển thị được cắt gọn phía render, không cắt ở validate.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  heading?: string;
}
