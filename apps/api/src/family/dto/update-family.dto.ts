import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateFamilyDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      "The family's cover photo (a Media id) — shown beside the family " +
      'name on Omoide and the Home group strip. Must be an image the ' +
      'setter may see AND that the whole family may: a photo from a post ' +
      'shared to this family, or one the setter uploaded. null clears it.',
  })
  // @IsOptional bỏ qua cả null lẫn undefined — null là "gỡ ảnh bìa",
  // undefined là "không đụng tới" (service phân biệt bằng !== undefined).
  @IsOptional()
  @IsUUID()
  coverMediaId?: string | null;
}
