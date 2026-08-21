import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Màn 27 (11h) → xin storyboard để sửa ở màn 31 (11j) — sync, chưa tạo job */
export class StoryboardRequestDto {
  @IsUUID()
  memberId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID(undefined, { each: true })
  mediaIds!: string[];

  /** "Say it in your own words — the narration follows this." */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storyRequest?: string;

  /** loại video: A year together / A trip / Birthday / In memory */
  @IsOptional()
  @IsIn(['year', 'trip', 'birthday', 'memory'])
  kind?: 'year' | 'trip' | 'birthday' | 'memory';

  /** nhãn dịp do user tự đặt qua nút "+" ở màn 27 — tự do, đi vào prompt */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  kindLabel?: string;

  @IsOptional()
  @IsIn([30, 60, 90, 120, 180])
  targetSec?: 30 | 60 | 90 | 120 | 180;

  @IsOptional()
  @IsIn(['warm', 'nostalgic', 'playful', 'quiet'])
  mood?: 'warm' | 'nostalgic' | 'playful' | 'quiet';

  @IsOptional()
  @IsIn(['en', 'ja', 'vi'])
  locale?: 'en' | 'ja' | 'vi';
}

export class PlanSceneDto {
  @IsUUID()
  mediaId!: string;

  @IsNumber()
  @Min(2)
  @Max(10)
  durationS!: number;

  @IsString()
  @MaxLength(80)
  caption!: string;

  /** lý do AI đặt cảnh ở vị trí này (màn 31 hiện dưới scene) — giữ lại để hiển thị sau render */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;

  /**
   * Giữ tiếng gốc của clip này hay không (màn 31 có nút loa cho từng cảnh).
   * Mặc định GIỮ — tiếng thật của khoảnh khắc là một phần của nó, và nó đã
   * được hạ xuống 20% khi trộn nên không át nhạc. Chỉ áp cho cảnh là clip;
   * ảnh tĩnh vốn không có tiếng.
   */
  @IsOptional()
  @IsBoolean()
  keepAudio?: boolean;
}

/** Plan đã duyệt/sửa ở màn 31 — gửi kèm khi tạo job mode 'ai' */
export class PlanDto {
  @IsString()
  @MaxLength(40)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(52)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  opening?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  closing?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  dedication?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlanSceneDto)
  scenes!: PlanSceneDto[];

  /** palette 4 hex từ storyboard (giữ nguyên khi user không đổi) */
  @IsOptional()
  palette?: Record<string, string>;
}

export class CreateVideoJobDto {
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID(undefined, { each: true })
  mediaIds!: string[];

  /** 'ai' = Build the story (kèm plan) | 'quick' = "Or just stitch the photos in my order" */
  @IsIn(['ai', 'quick'])
  mode!: 'ai' | 'quick';

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanDto)
  plan?: PlanDto;

  @IsOptional()
  @IsIn([30, 60, 90, 120, 180])
  targetSec?: 30 | 60 | 90 | 120 | 180;

  @IsOptional()
  @IsIn(['warm', 'nostalgic', 'playful', 'quiet'])
  mood?: 'warm' | 'nostalgic' | 'playful' | 'quiet';

  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  aspect?: 'portrait' | 'landscape';

  /** 1 trong 6 phong cách card mở đầu/kết (màn 30) hoặc 'none' */
  @IsOptional()
  @IsIn(['album', 'cinema', 'film', 'letter', 'seasonal', 'polaroid', 'none'])
  style?:
    'album' | 'cinema' | 'film' | 'letter' | 'seasonal' | 'polaroid' | 'none';

  /** id track thư viện (màn 29) | 'none' | 'media:<mediaId>' = "Use your own song" (upload qua /media) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  musicId?: string;
}

export class ShareVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
