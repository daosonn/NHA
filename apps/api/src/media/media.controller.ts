import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import {
  MediaService,
  type MediaSummary,
  type UploadedImage,
} from './media.service';

// Single upload limit for every media type (team decision 2026-08-18).
// Multer rejects larger files with 413 before they reach the service.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Upload a photo, video, or audio file; attach it to a post via mediaIds (WBS 1.5.3)',
  })
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedImage,
  ): Promise<MediaSummary> {
    return this.mediaService.upload(user.userId, file);
  }

  @Get(':mediaId')
  @ApiOperation({ summary: 'Stream a media file the viewer is allowed to see' })
  async download(
    @CurrentUser() user: AuthUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.mediaService.openForViewer(
      user.userId,
      mediaId,
    );
    return new StreamableFile(stream, { type: mimeType });
  }
}
