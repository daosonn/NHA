import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Màn "Edit family" (mockup 13b) — mọi field tuỳ chọn, gửi gì sửa nấy. */
export class UpdateFamilyDto {
  @ApiPropertyOptional({ maxLength: 80, example: 'ヴァン家' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 120,
    example: 'Hanoi, Vietnam',
    description: 'Dòng phụ dưới tên nhà. Chuỗi rỗng hoặc null = xoá.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 140,
    description: 'Đôi câu cả nhà tự giới thiệu. Chuỗi rỗng hoặc null = xoá.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  about?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The family's cover photo (a Media id). Must be an image the setter " +
      'may see AND that the whole family may: a photo from a post shared ' +
      'to this family, or one the setter uploaded. null clears it.',
  })
  // @IsOptional bỏ qua cả null lẫn undefined — null là "gỡ ảnh bìa",
  // undefined là "không đụng tới" (service phân biệt bằng !== undefined).
  @IsOptional()
  @IsUUID()
  coverMediaId?: string | null;
}
