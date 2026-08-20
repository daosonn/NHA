import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Màn 24-25 (11e/11f) — 3 biến thể + "Say it differently" (đổi tone → gọi lại) */
export class MessageRequestDto {
  @IsString()
  @MaxLength(80)
  occasionLabel!: string;

  /** ô "Anything to add" — vd "I cannot come home this year" */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  extraNote?: string;

  @IsOptional()
  @IsIn(['warm', 'formal', 'playful'])
  tone?: 'warm' | 'formal' | 'playful';

  @IsOptional()
  @IsIn(['en', 'ja', 'vi'])
  locale?: 'en' | 'ja' | 'vi';

  /** true = bỏ qua cache (nút "Say it differently" phải RA BẢN MỚI, không trả lại bản cũ) */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
