import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

/**
 * Omitted fields stay unchanged; an empty string clears a text field.
 * The post's type and its media set are not editable — `type` and
 * `mediaIds` are omitted here, so the whitelist ValidationPipe strips
 * them from PATCH bodies instead of applying them.
 */
export class UpdatePostDto extends PartialType(
  OmitType(CreatePostDto, ['type', 'mediaIds'] as const),
) {}
