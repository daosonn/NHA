import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Màn 21 (11a) — "Who, when, how much — nothing else" */
export class GiftIdeasRequestDto {
  @IsString()
  @MaxLength(80)
  occasionLabel!: string;

  @IsOptional()
  @IsISO8601()
  occasionDate?: string;

  /** nhãn range từ slider ngân sách, vd "3.000〜8.000円" — free text để không khoá đơn vị tiền */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  budgetLabel?: string;

  @IsOptional()
  @IsIn(['en', 'ja', 'vi'])
  locale?: 'en' | 'ja' | 'vi';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  maxIdeas?: number;

  /** nút ↻ ở màn Ideas — bỏ qua cache, hỏi AI lại từ đầu */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

/** Nút Save trên card ý tưởng (màn 22) — lưu để "Two ideas you saved last year" + không gợi lại */
export class SaveGiftIdeaDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  why?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  priceRange?: string;

  /** dịp lúc lưu — đi vào signal gift_feedback để rollup biết ngữ cảnh */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  occasionLabel?: string;

  /** ngôn ngữ cho lần rollup NỀN ngay sau ♡ — thiếu nó hồ sơ gia đình ja bị chưng cất bằng en */
  @IsOptional()
  @IsIn(['en', 'ja', 'vi'])
  locale?: 'en' | 'ja' | 'vi';
}
