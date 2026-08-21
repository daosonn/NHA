import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
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
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import {
  MediaService,
  type MediaSummary,
  type UploadedMediaFile,
} from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  // Storage + size limit come from MulterModule config in MediaModule.
  @UseInterceptors(FileInterceptor('file'))
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
    @UploadedFile() file?: UploadedMediaFile,
  ): Promise<MediaSummary> {
    return this.mediaService.upload(user.userId, file);
  }

  @Get(':mediaId/poster')
  @ApiOperation({
    summary:
      'Ảnh xem trước (khung đầu) của một video — thẻ bài đăng và lưới ảnh cần một tấm ảnh để vẽ',
  })
  async poster(
    @CurrentUser() user: AuthUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { path } = await this.mediaService.posterForViewer(
      user.userId,
      mediaId,
    );
    // Khung này không bao giờ đổi với một video đã tải lên
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(createReadStream(path), { type: 'image/jpeg' });
  }

  @Get(':mediaId')
  @ApiOperation({
    summary:
      'Stream a media file the viewer is allowed to see (supports Range for video/audio playback)',
  })
  async download(
    @CurrentUser() user: AuthUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('range') range?: string,
  ): Promise<StreamableFile | undefined> {
    const result = await this.mediaService.openForViewer(
      user.userId,
      mediaId,
      range,
    );
    res.setHeader('Accept-Ranges', 'bytes');
    // The Content-Type replays what the client declared at upload; nosniff
    // keeps browsers from second-guessing it.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (result.kind === 'unsatisfiable') {
      res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
      res.setHeader('Content-Range', `bytes */${result.size}`);
      return undefined;
    }
    if (result.kind === 'partial') {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader(
        'Content-Range',
        `bytes ${result.start}-${result.end}/${result.size}`,
      );
      return new StreamableFile(result.stream, {
        type: result.mimeType,
        length: result.end - result.start + 1,
      });
    }
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.size,
    });
  }
}
