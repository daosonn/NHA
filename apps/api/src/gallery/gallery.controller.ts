import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { GalleryService, type GalleryMediaItem } from './gallery.service';

@ApiTags('gallery')
@ApiBearerAuth()
@Controller('me/gallery')
export class MeGalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Get()
  @ApiOperation({
    summary:
      'My derived photo gallery, newest first (WBS 1.6.4) — media from ' +
      'posts I authored or was tagged in, plus my life-event media',
  })
  list(@CurrentUser() user: AuthUser): Promise<GalleryMediaItem[]> {
    return this.galleryService.listOwn(user.userId);
  }
}

@ApiTags('gallery')
@ApiBearerAuth()
@Controller('families/:familyId/members/:memberId/gallery')
export class MemberGalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Get()
  @ApiOperation({
    summary:
      "A member's derived photo gallery — linked member shows their " +
      'global gallery, placeholder its family-local one',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<GalleryMediaItem[]> {
    return this.galleryService.listForMember(user.userId, familyId, memberId);
  }
}
